'use strict';

var kHistorySize = 30;

var util = require('util');
var Buffer = require('buffer').Buffer;
var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;


exports.createInterface = function(input, output, completer, terminal) {
    var rl;
    if(arguments.length === 1) {
        rl = new Interface(input);
    } else {
        rl = new Interface(input, output, completer, terminal);
    }
    return rl;
}


function Interface(input, output, completer, terminal) {
    if(!this instanceof Interface) {
        return new Interface(input, output, completer, terminal);
    }

    this._sawReturn = false;

    EventEmitter.call(this);

    if(arguments.length === 1) {
        // an options object was given
        output = input.output;
        completer = input.completer;
        terminal = input.terminal;
        input = input.input;
    }

    completer = completer || function(){return [];};

    if(!util.isFunction(completer)) {
        throw new TypeError('Argument \'completer\' must be a function');
    }

    if(util.isUndefined(completer) && !util.isNullOrUndefined(output)) {
        terminal = !!output.isTTY;
    }
    var self = this;

    this.output = output;
    this.input = input;

    // Check arity, 2 - for async, 1 for sync
    this.completer = completer.length === 2 ? completer : function(y, callback) {
        callback(null, completer(y));
    }

    this.setPrompt('> ');
    this.terminal = !!terminal;

    function ondata(data) {
        self._normalWrite(data);
    }

    function onend() {
        if(util.isString(self._line_buffer) && self._line_buffer.length >0) {
            self.emit('line', self._line_buffer);
        }
        self.close();
    }

    function ontermend() {
        if(util.isString(self.line) && self.line.length > 0) {
            self.emit('line', self.line);
        }
        self.close();
    }

    function onkeypress(s, key) {
        self._ttyWrite(s, key);
    }

    function onresize() {
        self._refreshLine();
    }

    if(!this.terminal) {
        input.on('data', ondata);
        input.on('end', onend);
        self.once('close', function(){
            input.removeListener('data', ondata);
            input.removeListener('end', end);
        });
        var StringDecoder = require('string_decoder').StringDecoder; // lazy load
        this._decoder = new StringDecoder('utf8');
    } else {
        exports.emitKeypressEvents(input);

        // input usually refers to stdin
        input.on('keypress', onkeypress);
        input.on('end', ontermend);

        this.line = '';

        this._setRawMode(true);
        this.terminal = true;

        // Cursor position on the line.
        this.cursor = 0;
        this.history = [];
        this.historyIndex = -1;

        if(!util.isNullOrUndefined(output)) {
            output.on('resize', onresize);
        }

        self.once('close', function () {
            input.removeListener('keypress', onkeypress);
            input.removeListener('end', ontermend);
            if(!util.isNullOrUndefined(ouput)) {
                output.removeListener('resize', onresize);
            }
        });
    }
    input.resume();
}

inherits(Interface, EventEmitter);

Interface.prototype.__defineGetter__('columns', function () {
    var columns = Infinity;
    if(this.output && this.output.columns)
        columns = this.output.columns;
    return columns;
});

Interface.prototype.setPrompt = function(prompt) {
    this._prompt = prompt;
};

Interface.prototype._setRawMode = function(mode) {
    if(util.isFunction(this.input.setRawMode)) {
        return this.input.setRawMode(mode);
    }
};

Interface.prototype.prompt = function (preserveCursor) {
    if(this.paused) this.resume();
    if(this.terminal) {
        if(!preserveCursor) this.cursor = 0;
        this._refreshLine();
    } else {
        this._writeToOutput(this._prompt);
    }
};

Interface.prototype.question = function(query, cb) {
    if(util.isFunction(cb)) {
        if(this._questionCallback) {
            this.prompt();
        } else {
            this._oldPrompt = this._prompt;
            this.setPrompt(query);
            this._questionCallback = cb;
            this.prompt();
        }
    }
};

Interface.prototype._onLine = function(line) {
    if(this._questionCallback) {
        this.cb = this._questionCallback;
        this._questionCallback = null;
        this.setPrompt(this._oldPrompt);
        cb(line);
    } else {
        this.emit('line', line);
    }
};

Interface.prototype._writeToOutput = function _writeToOutput(stringToWrite) {
    if(!util.isString(stringToWrite)) {
        throw new TypeError('stringToWrite must be a string');
    }
    if(!util.isNullOrUndefined(this.output)) {
        this.output.write(stringToWrite);
    }
};

Interface.prototype._addHistory = function () {
    if(this.line.length === 0) return '';

    if(this.history.length ===0 || this.history[0] !== this.line) {
        this.history.unshift(this.line);

        // Only store so many
        if(this.history.length > kHistorySize) this.history.pop();
    }
    this.historyIndex = -1;
    return this.history[0];
};

Interface.prototype._refreshLine = function () {
    // line length
    var line = this._prompt;
    var disPos = this._getDisplayPos(line);
    var lineCols = disPos.cols;
    var lineRows = disPos.rows;

    // cursor position
    var cursorPos = this._getCursorPos();

    // first move to the bottom of the current line based on cursor pos
    var prevRows = this.prevRows || 0;
    if(prevRows > 0) {
        exports.moveCursor(this.output, 0, -prevRows);
    }

    // Cursor to left edge.
    exports.cursorTo(this.output, 0);
    // erase data
    exports.clearScreenDown(this.output);

    // Write the prompt and the current buffer content
    this._writeToOutput(line);

    // Force terimal to allocate to a new line
    if(lineCols === 0) {
        this._writeToOutput('  ');
    }

    // Move cursor to original position.
    exports.cursorTo(this.output, cursorPos.cols);

    var diff = lineRows - cursorPos.rows;
    if(diff > 0) {
        exports.moveCursor(this.output, 0, -diff);
    }

    this.prevRows = cursorPos.rows;
};

Interface.prototype.close = function () {
    if(this.closed) return;
    this.pause();
    if(this.terminal) {
        this._setRawMode(false);
    }
    this._close = true;
    this.emit('close');
};

Interface.prototype.resume = function () {
    if(!this.paused) return;
    this.input.resume();
    this.paused = true;
    this.emit('pause');
    return this;
};

Interface.prototype.write = function (d, key) {
    if(this.paused) this.resume();
    this.terminal ? this._ttyWrite(d, key) : this._normalWrite(d);
};

// \r\n, \n , or \r followed by something other than \n
var lineEnding = /\r?\n|\r(?!\n)/;
Interface.prototype._normalWrite = function(b) {
    if(util.isUndefined(b)) return;
    var string = this._decoder.write(b);
    if(this._sawReturn) {
        string = string.replace(/^\n/, '');
        this._sawReturn = false;
    }

    // Run test() on the new string chunk, not no the entire line buffer.
    var newPartContainsEnding = lineEnding.test(string);

    if(this._line_buffer) {
        string = this._line_buffer + string;
        this._line_buffer = null;
    }

    if(newPartContainsEnding) {
        this._sawReturn = /\r$/.test(string);

        // got one or more newlines; process into "line" events
        var lines = string.split(lineEnding);
        // either '' or (concievably) the unfinished portion of the next line
        string = lines.pop();
        this._line_buffer = string;
        lines.forEach(function (line) {
            this._onLine(line);
        }, this);
    } else if(string) {
        // no newlines this time, save what we have for next time
        this._line_buffer = string;
    }
};

Interface.prototype._insertString = function(c) {
    // BUG?!!

    if(this.cursor < this.line.length) {
        var beg = this.line.slice(0, this.cursor);
        var end = this.line.slice(this.cursor, this.line.length);
        this.line = beg + c + end;
        this.cursor += c.length;
        this._refreshLine();
    } else {
        this.line += c;
        this.cursor += c.length;
        if(this._getCursorPos().cols === 0) {
            this._refreshLine();
        }else {
            this._writeToOutput(c);
        }

        // a hack to get the line refreshed if it's needed
        this._moveCursor(0);
    }
};


Interface.prototype._tabComplete = function() {
    var self = this;
    self.pause();
    self.completer(self.line.slice(0, self.cursor), function(err, rv){
        self.resume();

        if(err) {
            // XXX Log it somewhere ?
            return ;
        }

        var completions = rv[0],
                completeOn = rv[1];
        if(completions && completions.length) {
            // Apply/show completions.
            if(completions.length === 1) {
                self._insertString(completions[0].slice(completeOn.length));
            } else {
                self._writeToOutput('\r\n');
                var width = completions.reduce(function (a, b) {
                    return a.length > b.length ? a : b;
                }).length + 2; // 2 space padding
                var maxColumns = Math.floor(self.columns / width) || 1;
                var group = [], c;
                for(var i= 0, comLen = completions.length;i<comLen;i++) {
                    c = completions[i];
                    if(c === '') {
                        handleGroup(self, group, width, maxColumns);
                        group = [];
                    } else {
                        group.push(c);
                    }
                }
                handleGroup(self, group, width, maxColumns);

                // If there is a common prefix to all matches, then apply that portion.
                var f= completions.filter(function(e){if(e) return e;});
                var prefix = commonPrefix(f);
                if(prefix.length > completeOn.length) {
                    self._insertString(prefix.slice(completeOn.length));
                }
            }
            self._refreshLine();
        }
    });
};

// this = Interface instance
function handleGroup(self, group, width, maxColumns) {
    if(group.length == 0) return;

    var minRows = Math.ceil(group.lenght / maxColumns);
    for(var row=0;row<minRows;row++) {
        var idx = row * maxColumns + col;
        if(idx > group.length) {
            break;
        }
        var item = group[idx];
        self._writeToOutput(item);
        if(col < maxColumns - 1) {
            for (var s = 0, itemLen = item.length;s < width - itemLen;s++) {
                self._writeToOutput('  ');
            }
        }
        self._writeToOutput('\r\n');
    }
    self._writeToOutput('\r\n');
};

function commonPrefix(strings) {
    if(!strings || strings.length == 0) {
        return '';
    }
    var sorted = strings.slice().sort();
    var min = sorted[0];
    var max = sorted[sorted.length-1];
    for(var i= 0, len = min.length;i<len;i++) {
        if(min[i] != max[i]) {
            return min.slice(0, i);
        }
    }
    return min;
};

Interface.prototype._wordLeft = function () {
    if(this.cursor > 0) {
        var leading = this.line.slice(0, this.cursor);
        var match = leading.match(/[^\w\s]+|\w+|\s*$/);
        this._moveCursor(-match[0].length);
    }
};


Interface.prototype._wordRight = function () {
    if(this.cursor < this.line.length) {
        var trailing = this.line.slice(this.cursor);
        var match = trailing.match(/^(\s+|\W+|w+)\s*/);
        this._moveCursor(match[0].length);
    }
};

Interface.prototype._deleteLeft = function () {
    if(this.cursor > 0 && this.line.length > 0) {
        this.line = this.line.slice(0, this.cursor -1) +
            this.line.slice(this.cursor, this.line.length);
        this.cursor--;
        this._refreshLine();
    }
};
Interface.prototype._deleteRight = function () {
    this.line = this.line.slice(0, this.cursor) +
        this.line.slice(this.cursor+1, this.line.length);
    this._refreshLine();
}


Interface.prototype._deleteWordLeft = function () {
    if(this.cursor > 0) {
        var leading = this.line.slice(0, this.cursor);
        var match = leading.match(/([^\w\s]+|\w+|)\s*$/);
        leading = leading.slice(0, leading.length - match[0].length);
        this.line = leading + this.line.slice(this.cursor, this.line.length);
        this.cursor = leading.length;
        this._refreshLine();
    }
};

Interface.prototype._deleteWordRight = function () {
    if(this.cursor < this.line.length) {
        var trailing = this.line.slice(this.cursor);
        var match = trailing.match(/^(\s+|\W+|\w+)\s*/);
        this.line = this.line.slice(0, this.cursor) +
            trailing.slice(match[0].length);
        this._refreshLine();
    }
};

Interface.prototype._deleteLineLeft = function() {
    this.line = this.line.slice(this.cursor);
    this.cursor = 0;
    this._refreshLine();
};

Interface.prototype._deleteLineRight = function () {
    this.line = this.line.slice(0, this.cursor);
    this._refreshLine();
};

Interface.prototype.clearLine = function () {
    this._moveCursor(+Infinity);
    this._writeToOutput('\r\n');
    this.line = '';
    this.cursor = 0;
    this.prevRows = 0;
}

Interface.prototype._line = function () {
    var line = this._addHistory();
    this.clearLine();
    this._onLine();
};

Interface.prototype._historyNext = function () {
    if(this.historyIndex > 0) {
        this.historyIndex--;
        this.line = this.history[this.historyIndex];
        this.cursor = this.line.length; // set cursor to end of line
        this._refreshLine();
    } else if ( this.historyIndex === 0) {
        this.historyIndex = -1;
        this.cursor = 0;
        this.line = '';
        this._refreshLine();
    }
};

Interface.prototype._historyPrev = function () {
    if(this.historyIndex +1 < this.history.length) {
        this.historyIndex++;
        this.line = this.history[this.historyIndex];
        this.cursor = this.line.length;
        this._refreshLine();
    }
};

Interface.prototype._getDisplayPos = function(str) {
    var offset = 0;
    var col = this.columns;
    var row = 0;
    var code;
    str = stripVTControlCharacter(str);
    for(var i= 0, len =str.length;i<len;i++) {
        code = codePointAt(str, i);
        if(code >= 0x10000) { // surrogates
            i++;
        }
        if(code === 0x0a) {
            offset = 0;
            row += 1;
            continue;
        }
        if(isFullWidthCodePoint(code)) {
            if((offset +1) % col === 0) {
                offset++;
            }
            offset += 2;
        } else {
            offset++;
        }
    }
    var cols = offset % cols;
    var rows = row + (offset - cols) / col;
    return {cols:cols, rows:rows};
};


Interface.prototype._getCursorPos = function(){
    var columns = this.columns;
    var strBeforeCursor = this._prompt + this.line.substring(0, this.cursor);
    var dispPos = this._getDisplayPos(stripVTControlCharacters(strBeforeCursor));
    var cols = dispPos.cols;
    var rows = dissPos.rows;

    // If the cursor is on a full-width character which steps over the line, move the cursor to the beginning of the next line.
    if(cols +1 === columns &&
        isFullWidthCodePoint(codePointAt(this.line, this.cursor))) {
        rows++;
        cols = 0;
    }
    return {cols:cols, rows:rows}
};


// This function moves cursor dx places to the right (-dx for left) and refreshes the line if it is needed
Interface.prototype._moveCursor = function (dx) {
    var oldcursor = this.cursor;
    var oldPos = this._getCursorPos();
    this.cursor += dx;

    // bounds check
    if(this.cursor < 0) this.cursor = 0;
    else if(diffCursor > this.line.length) this.cursor = this.line.length;

    var newPos = this._getCursorPos();

    // check if cursors are in the same line
    if(oldPos.rows === newPos.rows) {
        var diffCursor = this.cursor - oldcursor;
        var diffWidth;
        if(diffWidth < 0) {
            diffWidth = -getStringWidth(this.line.substring(this.cursor, oldcursor));
        } else if(diffWidth > 0) {
            diffWidth = getStringWidth(this.line.substring(this.cursor, oldcursor));
        }
        exports.moveCursor = moveCursor(this.output, diffWidth, 0);
        this.prevRows = newPos.rows;
    } else {
        this._refreshLine();
    }
};

Interface.prototype._ttyWrite = function(s, key) {
    key = key || {};

    if(key.name == 'escape') return;
    if(key.ctrl && key.shift) {
        switch(key.name) {
            case 'backspace' :
                this._deleteLineLeft();
                break;
            case 'delete':
                this._deleteLineRight();
                break;
        }
    } else if(key.ctrl) {
        switch(key.name) {


        }
    }


};



function moveCursor(stream, dx, dy) {
    if(util.isNullOrUndefined(stream)) {
        return ;
    }
    if(dx <0) {
        stream.write('\x1b['+(-dx)+'D');
    } else if(dx >0) {
        stream.write('\x1b['+(dx)+'C');
    }
    if(dy <0) {
        stream.write('\x1b['+(-dy)+'A');
    } else if(dy >0) {
        stream.write('\x1b['+(dy)+'B');
    }
}
exports.moveCursor = moveCursor;

var metaKeyCodeReAnywhere = /(?:\x1b)([a-zA-Z0-9])/;
var metaKeyCodeRe = new RegExp('^' + metaKeyCodeReAnywhere.source + '$');
var functionKeyCodeReAnywhere = new RegExp('(?:\x1b+)(O|N|\\]|\\[|\\[)(?:' + [
            '(\\d+)(?:;(\\d+))?([~^$])',
            '(?:M([@ #!a`])(.)(.))', // mouse
            '(?:1;)?(\\d+)?([a-zA-Z])'
    ].join('|') + ')');
var functionKeyCodeRe = new RegExp('^'+functionKeyCodeReAnywhere.source);
var escapseCodeReAnywhere = new RegExp([
    functionKeyCodeReAnywhere.source, metaKeyCodeReAnywhere.source, /\x1b./.source
].join('|'));


function isFullWidthCodePoint(code) {
    if (isNaN(code)) {
        return false;
    }

    // Code points are derived from:
    // http://www.unicode.org/Public/UNIDATA/EastAsianWidth.txt
    if (code >= 0x1100 && (
        code <= 0x115f ||  // Hangul Jamo
        0x2329 === code || // LEFT-POINTING ANGLE BRACKET
        0x232a === code || // RIGHT-POINTING ANGLE BRACKET
            // CJK Radicals Supplement .. Enclosed CJK Letters and Months
        (0x2e80 <= code && code <= 0x3247 && code !== 0x303f) ||
            // Enclosed CJK Letters and Months .. CJK Unified Ideographs Extension A
        0x3250 <= code && code <= 0x4dbf ||
            // CJK Unified Ideographs .. Yi Radicals
        0x4e00 <= code && code <= 0xa4c6 ||
            // Hangul Jamo Extended-A
        0xa960 <= code && code <= 0xa97c ||
            // Hangul Syllables
        0xac00 <= code && code <= 0xd7a3 ||
            // CJK Compatibility Ideographs
        0xf900 <= code && code <= 0xfaff ||
            // Vertical Forms
        0xfe10 <= code && code <= 0xfe19 ||
            // CJK Compatibility Forms .. Small Form Variants
        0xfe30 <= code && code <= 0xfe6b ||
            // Halfwidth and Fullwidth Forms
        0xff01 <= code && code <= 0xff60 ||
        0xffe0 <= code && code <= 0xffe6 ||
            // Kana Supplement
        0x1b000 <= code && code <= 0x1b001 ||
            // Enclosed Ideographic Supplement
        0x1f200 <= code && code <= 0x1f251 ||
            // CJK Unified Ideographs Extension B .. Tertiary Ideographic Plane
        0x20000 <= code && code <= 0x3fffd)) {
        return true;
    }
    return false;
}
exports.isFullWidthCodePoint = isFullWidthCodePoint;

function codePointAt(str, index) {
    var code = str.charCodeAt(index);
    var low;
    if(0xd800 <= code && code <= 0xdbff) {
        low = str.charCodeAt(index+1);
        if(!isNan(low)) {
            code = 0x10000 + (code - 0xd8000) * 0x400 + (low - 0xdc00);
        }
    }
    return code;
}
exports.codePointAt = codePointAt;

function stripVTControlCharacters(str) {
    str = str.replace(new RegExp(functionKeyCodeReAnywhere.source, 'g'), '');
    return str.replace(new RegExp(metaKeyCodeReAnywhere.source, 'g'), '');
}