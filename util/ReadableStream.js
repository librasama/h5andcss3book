module.exports = MyReadable;
MyReadable.ReadableState = ReadableState;

var EE = require('events').EventEmitter;
var Stream = require('stream');
var Buffer = require('buffer').Buffer;
var util = require('util');
var StringDecoder;
var debug = util.debuglog('stream');

util.inherits(MyReadable, Stream);

function ReadableState(options, stream) {
    options = options || {};

    // object stream flag. Used to make read(n) ignore n and to make all the buffer merging and length checks go away
    this.objectMode = !!options.objectMode;
    if(stream instanceof Stream.Duplex)
        this.objectMode = this.objectMode || !!options.readableObjectMode;

    // the point at which it stops calling _read() to fill the buffer.Note:0 is a valid value, means "don't call _read preemptively ever"
    var hwm = options.highWaterMark;
    var defaultHwm = this.objectMode ? 16 : 16*1024;
    this.highWaterMark = (hwm || hwm ===0)?hwm:defaultHwm;
   // cast to ints.
    this.highWaterMark = ~~this.highWaterMark;

    this.buffer = [];
    this.length = 0;
    this.pipes = null;
    this.pipesCount = 0;
    this.flowing = null;
    this.ended = false;
    this.endEmitted = false;
    this.reading = false;

    // a flag to be able to tell if the onwrite cb is called immediately, or on a later tick. We set this to true at first,
    // because any actions that shouldn't happen until "later" should generally also not happen before the first write call.
    this.sync = true;

    // wheneven we return null, then we set a flag to say that we're awaiting a 'readable' event emission.
    this.needReadable = false;
    this.emittedReadable = false;
    this.readableListining = false;

    // Crypto is kind of old and crusty. Historically, its default string encoding is 'binary' so we have to make this configureable.
    // Everything else in the universe uses 'utf8', though.
    this.defaultEncoding = options.defaultEncoding ||　'utf8';

    //when piping, we only care about 'readable' events that happen after read()ing all the bytes and not getting any pushback.
    this.ranOut = false;

    // the number of writers that are awaiting a drain event in .pipe()s
    this.awaitDrain = 0;

    // if true, a maybeReadMore has been scheduled
    this.readingMore = false;

    this.decoder = null;
    this.encoding = null;
    if(options.encoding) {
        if(!StringDecoder)
            StringDecoder = require('string_decoder').StringDecoder;
        this.decoder = new StringDecoder(options.encoding);
        this.encoding = options.encoding;
    }
}

function MyReadable(options) {
    if(!(this instanceof Readable))
        return new Readable(options);
    this._readableState = new ReadableState(options, this);

    // legacy
    this.readable = true;
    Stream.call(this);
}

// Mannually shove something into the read() buffer. This returns true if highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should write() some more.
MyReadable.prototype.push = function(chunk, encoding) {
    var state = this._readableState;

    if(util.isString(chunk) && !state.objectMode){
        encoding = encoding || state.defaultEncoding;
        if(encoding !== state.encoding) {
            chunk = new Buffer(chunk, encoding);
            encoding = '';
        }
    }
    return readableAddChunk(this, state, chunk, encoding, false);
};

// Unshift should *always* be something directly out of read();
MyReadable.prototype.unshift = function(chunk) {
    var state = this._readableState;
    return readableAddChunk(this, state, chunk, '', true);
};

MyReadable.prototype.isPaused = function() {
    return this._readableState.flowing === false;
};

function readableAddChunk(stream, state, chunk, encoding, addToFront) {
    var er = chunkInvalid(state, chunk);
    if(er) {
        stream.emit('error', er);
    } else if(chunk === null) {
        state.reading = false;
        if(!state.ended)
            onEofChunk(stream, state);
    } else if(state.objectMode || chunk && chunk.length >0) {
        if(state.ended && !addToFront) {
            var e = new Error('stream.push() after EOF');
            stream.emit('error', e);
        } else if(state.endEmitted && addToFront) {
            var e = new Error('stream.unshift() after end event');
            stream.emit('error', e);
        } else {
            if(state.decoder && !addToFront && !encoding)
                chunk = state.decoder.write(chunk);
            if (!addToFront)
                state.reading = false;
            // if we want the data now, just emit it.
            if(state.flowing && state.length === 0 && !state.sync) {
                stream.emit('data', chunk);
                stream.read(0);
            } else {
                // update the buffer info
                state.length += state.objectMode ? 1 : chunk.length;
                if(addToFront) {
                    state.buffer.unshift(chunk);
                } else {
                    state.buffer.push(chunk);
                }

                if(state.needReadable) {
                    emitReadable(stream);
                }
            }
            maybeReadMore(stream, state);
        }
    } else if (!addToFront) {
        state.reading = false;
    }
    return needMoreData(state);
}

function needMoreData(state) {
    return !state.ended &&
            (state.needReadable ||
            state.length < state.highWaterMark ||
            state.length === 0);
}


MyReadable.prototype.setEncoding = function(enc) {
    if(!StringDecoder)
        StringDecoder = require('string_decoder').StringDecoder;
    this._readableState.decoder = new StringDecoder(enc);
    this._readableState.encoding = enc;
    return this;
};

var MAX_HWM = 0X800000;

//??????? 什么意思？？
function roundUpToNextPowerOf2(n) {
    if(n >= MAX_HWM) {
        n = MAX_HWM;
    } else {
        // Get the next highest power of 2
        n--;
        for(var p=1;p<32;p <<1)
        n |= n >>p;
        n++;
    }
    return n;
}

function howMuchToRead(n, state) {
    if(state.length === 0 && state.ended) {
        return 0;
    }
    if(state.objectMode)
        return n === 0?0:1;
    if(util.isNull(n) || isNaN(n)) {
        // only flow one buffer at a time
        if(state.flowing && state.buffer.length)
            return state.buffer[0].length;
        else
            return state.length;
    }
    if(n<0)
        return 0;

    // If we're asking for more than the target buffer level, then raise the water mark. Bump up the the next highest power of 2,
    // to prevent increasing it excessively in tiny amounts.
    if(n > state.highWaterMark) {
        state.highWaterMark = roundUpToNextPowerOf2(n);
    }
    //don't have that much. return null, unless we've ended.
    if(n > state.length) {
        if(!state.ended) {
            state.needReadable = true;
            return 0;
        } else {
            return state.length;
        }
    }
    return n;
}

MyReadable.prototype.read = function(n) {
    debug('debug', n);
    var state = this._readableState;
    var n0rig = n;

    if(!util.isNumber(n) || n >0) {
        state.emittedReadable = false;
    }

    // if we're doing read(0) to trigger a readable event, but we already have a bunch of data in the buffer, then just trigger the
    // 'readable' event and move on.
    if(n ===0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
        debug('read: emitReadable', state.length, state.ended);
        if(state.length === 0 && state.ended) {
            endReadable(this);
        } else {
            emitReadable(this);
        }
        return null;
    }
    n = howMuchToRead(n, state);

    // if we've ended, and we're now clear, the finish it up.
    if(n === 0 && state.ended) {
        if(state.length ===0) {
            endReadable(this);
        }
        return null;
    }

    //真正开始读取咯~！
    var doRead = state.needReadable;
    debug('need readable', doRead);

    // if we currently have less than the highWaterMark, then also read some
    if(state.length === 0 || state.length-n < state.highWaterMark) {
        doRead = true;
        debug('length less then water');
    }

}

function chunkInvalid(state, chunk) {
    var er = null;
    if(!util.isBuffer(chunk) &&
       !util.isString(chunk) &&
       !util.isNullOrUndefined(chunk) &&
       ! state.objectMode) {
        er = new TypeError('Invalid non-string/buffer chunck');
    }
    return er;
}


function onEofChunk(stream, state) {
    if(state.decoder &&  !state.ended) {
        var chunk = state.decoder.end();
        if(chunk && chunk.length) {
            state.buffer.push(chunk);
            state.length += state.objectMode ? 1 : chunk.length;
        }
    }
    state.ended = true;

    // emit 'readable' now to make sure it gets picked up
    emitReadable(stream);
}


// Don't emit reaable right away in sync mode, because this can trigger another read() call => stack overflow.
// This way, it might trigger a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
    var state = stream._readableState;
    state.needReadable = false;
    if(!state.emittedReadable) {
        debug('emitReadable', state.flowing);
        state.emittedReadable = true;
        if(state.sync) {
            process.nextTick(function(){emitReadable_(stream);});
        } else {
            emitReadable_(stream);
        }
    }
}

function emitReadable_(stream) {
    debug('emit readable');
    stream.emit('readable');
    flow(stream);
}

function maybeReadMore(stream, state) {
    if(!state.readingMore) {
        state.readingMore = true;
        process.nextTick(function () {
            maybeReadMore_(stream, state);
        });
    }
}

function maybeReadMore_(stream, state)  {
    var len = state.length;
    while(!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
        debug('maybeReadmore read 0');
        stream.read(0);
        if(len === state.length)
            break;
        else
            len = state.length;
    }
    state.readingMore = false;
}

MyReadable.prototype._read = function(n) {
    this.emit('error', new Error('not implemented'));
}

MyReadable.prototype.pipe = function(dest, pipeOpts){
    var src = this;
    var state = this._readableState;
    switch (state.pipesCount) {
        case 0 :
            state.pipes = dest;
            break;
        case 1 :
            state.pipes = [state.pipes, dest];
            break;
        default:
            state.pipes.push(dest);
            break;
    }
    state.pipesCount += 1;
    debug('pipe count=%d opts%j', state.pipesCount, pipeOpts);

    var doEnd = (!pipeOpts || pipeOpts.end !== false) &&
            dest !== process.stdout &&
            dest !== process.stderr;

    var endFn = doEnd ? onend : cleanup;
    if(state.endEmitted) {
        process.nextTick(endFn);
    }
    else src.once('end', endFn);

    desc.on('unpipe', onunpipe);

    function onunpipe(readable) {
        debug('onunpipe');
        if(readable === src) {
            cleanup();
        }
    }
    function onend() {
        debug('onend');
        dest.end();
    }

    // when the dest drains, it reduces the awaitDrain counter on the source. This would be more elegant with a .once()
    // handler in flow(), but adding and removing repeatedly is too slow.
    var ondrain = pipeOnDrain(src);
    dest.on('drain', ondrain);

    function cleanup() {
        debug('cleanup');
        // cleanup event handlers once the pipe is broken
        dest.removeListener('close', onclose);
        dest.removeListener('finish', onfinish);
        dest.removeListener('drain', ondrain);
        dest.removeListener('error', onerror);
        dest.removeListener('unpipe', onunpipe);
        src.removeListener('end', onend);
        src.removeListener('end', cleanup);
        src.removeListener('data', ondata);

        if(state.awaitDrain && (!dest._writeableState || dest._writeableState.needDrain))
            ondrain();
    }
    src.on('data', ondata);
    function ondata(chunk) {
        debug('ondata');
        var ret = dest.write(chunk);
        if(false === ret) {
            debug('false write response, pause', src._readableState.awaitDrain);
            src._readableState.awaitDrain++;
            src.pause();
        }

    }

    function onerror(er) {
        debug('onerror', er);
        unpipe();
        dest.removeListener('error', onerror);
        if(EE.listenerCount(dest, 'error') === 0)
            dest.emit('error', er);
    }

    // This is a brutally ugly hack to make sure that our error handler is attached before any userland ones. NEVER DO THIS.
    if(!dest._events || !dest._events.error) {
        dest.on('error', onerror);
    } else if(Array.isArray(dest._events_error)) {
        dest._events.error.unshift(onerror);
    } else {
        dest._events.error = [onerror, dest._events.error];
    }

    function onclose() {
        dest.removeListener('finish', onfinish);
        unpipe();
    }
    dest.once('close', onclose);

    function onfinish() {
        debug('onfinish');
        dest.removeListener('close', onclose);
        unpipe();
    }
    dest.once('finish', onfinish);

    function unpipe() {
        debug('unpipe');
        src.unpipe(dest);
    }

    // tell the dest that it's being piped to
    dest.emit('pipe', src);
    if(!state.flowing) {
        debug('pipe resume');
        src.resume();
    }
    return dest;
};

function pipeOnDrain(src) {
    return function () {
        var state = src._readableState;
        debug('pipeOnDrain', state.awaitDrain);
        if(state.awaitDrain)
            state.awaitDrain--;
        if(state.awaitDrain === 0 && EE.listenerCount(src, 'data')) {
            state.flowing = true;
            flow(src);
        }
    }
}

MyReadable.prototype.unpipe = function(dest) {
    var state = this._readableState;
    if(state.pipesCount === 0) return this;
    if(state.pipesCount === 1) {
        if(dest && dest !== state.pipes)
            return this;
        if(!dest)
            dest = state.pipes;

        // got a match
        state.pipes = null;
        state.pipesCount = 0;
        state.flowing = false;

        if(dest)
            dest.emit('unpipe', this);
        return this;
    }

    if(!dest) {
        //remove all
        var dests = state.pipes;
        var len = state.pipesCount;
        state.pipes = null;
        state.pipesCount = 0;
        state.flowing = false;
        for(var i=0;i<len;i++) {
            dest[i].emit('unpipe', this);
        }
        return this;
    }

    // try to find the right one
    var i = state.pipes.indexOf(dest);
    if(i === -1) return this;

    state.pipes.slice(i,1);
    state.pipesCount -= 1;
    if(state.pipesCount === 1) {
        state.pipes = state.pipes[0];
    }
    dest.emit('unpipe', this);
    return this;
}


MyReadable.prototype.on = function(ev, fn) {
    var res = Stream.prototype.on.call(this, ev, fn);
    if(ev === 'data' && false !== this._readableState.flowing) {
        this.resume();
    }
    if(ev === 'readable' && this.readalbe) {
        var state = this._readableState;
        if(!state._readableListening) {
            state.readableListining = true;
            state.emittedReadable = false;
            state.needReadable = true;
            if(!state.reading) {
                var self = this;
                process.nextTick(function () {
                    debug('readable nexttick read 0');
                    self.read(0);
                });
            } else if(state.length) {
                emitReadable(this, state);
            }
        }
    }
    return res;
}

MyReadable.prototype.addListener = Readable.prototype.on;

MyReadable.prototype.resume = function() {
    var state = this._readableState;
    if(!state.flowing) {
        debug('resume');
        state.flowing = true;
        resume(this, state);
    }
    return this;
}

function resume(stream) {
    if(!state.resumeScheduled) {
        state.resumeScheduled = true;
        process.nextTick(function(){
            resume_(stream, state);
        });
    }
}

function resume_(stream, state) {
    if(!state.reading) {
        debug('resume read 0');;
        stream.read(0);
    }
    state.resumeScheduled = false;
    stream.emit('resume');
    flow(stream);
    if(state.flowing && !state.reading) {
        stream.read(0);
    }
}

MyReadable.prototype.pause = function () {
    debug('call pause flowing=%j', this._readableState.flowing);
    if(false !== this._readableState.flowing) {
        debug('pause');
        this._readableState.flowing = true;
        this.emit('pause');
    }
    return this;
}

function flow(stream) {
    var state = stream._readableState;
    debug('flow', state.flowing);
    if(state.flowing) {
        do {
            var chunk = stream.read();
        } while(null !== chunk && state.flowing);
    }
}


MyReadable._fromList = fromList;

function fromList(n, state) {
    var list = state.buffer;
    var length = state.length;
    var stringMode = !!state.decoder;
    var objectMode = !!state.objectMode;
    var ret;

    // nothing in the list, definitely empty.
    if(list.lenght === 0) return null;
    if(length === 0)
        ret = null;
    else if (objectMode)
        ret = list.shift();
    else if (!n || n >= length) {
        // read it all, truncate the array.
        if(stringMode)
            ret = list.join('');
        else
            ret = Buffer.concat(list, length);

        list.length = 0;
    } else {
        // read just some of it
        if(n < list[0].length) {
            // just take a part of the first list item. slice is the same for buffers and settings
            var buf = list[0];
            ret = buf.slice(0, n);
            list[0] = buf.slice(n);
        } else if(n === list[0].length) {
            // first list is a perfect match
            ret = list.shift();
        } else {
            // complex case.
            // we have enough to cover it, but it spans past the first buffer.
            if(stringMode)
                ret = '';
            else
                ret = new Buffer(n);

            var c = 0;
            for(var i= 0, l =list.length;i<1 && c<n;i++) {
                var buf = list[0];
                var cpy = Math.min(n-c, buf.length);

                if(stringMode)
                    ret += buf.slice(0, cpy);
                else
                    buf.copy(ret, c, 0, cpy);
                if (cpy < buf.length) {
                    list[0] = buf.slice(cpy);
                } else {
                    list.shift();
                }
                c += cpy;
            }
        }
    }
    return ret;
}

function endReadable(stream) {
    var state = stream._readableState;

    // If we get here before consuming all the bytes, then that is a bug in node. Should never happen.
    if(state.length > 0) {
        throw new Error('endReadable called on non-empty stream');
    }
    if(!state.endEmitted) {
        state.ended = true;
        process.nextTick(function () {
            //Check that we didn't get one last unshift
            if(!state.endEmitted &&  state.length === 0) {
                state.endEmitted = true;
                stream.readable = false;
                stream.emit('end');
            }
        });
    }
}

