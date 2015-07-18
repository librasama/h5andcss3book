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
    this.defaultEncoding = options.defaultEncoding ||¡¡'utf8';

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

//??????? Ê²Ã´ÒâË¼£¿£¿
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
}

