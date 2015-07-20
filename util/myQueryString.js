var url = "http://www.yamibo.com/thread-1.html";
var encode = encodeURIComponent(url);
var decode = decodeURIComponent(encode);
console.log('转义过的url: ' + encode);
console.log('逆转义过的url: ' + decode);


var myQueryString = exports;
var util = require('util');

// If obj.hasOwnProperty has been overriden, then calling obj.hasOwnProperty(prop) will break. 查询字符串里如果含有hasOwnProperty，没有这个挡一下就崩溃
function hasOwnProperty(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
}

function charCode(c) {
    return c.charCodeAt(0);
}

// a safe fast alternative to decodeURIComponent
myQueryString.unescapeBuffer = function (s, decodeSpaces) {
var out = new Buffer(s.length);
var n, m, hexchar;
var state = 'CHAR'; // states : CHAR, HEX0, HEX1

for(var inIndex = 0, outIndex = 0;inIndex <= s.length;inIndex++) {
    var c = s.charCodeAt(inIndex);
    switch (state) {
        case 'CHAR' :
            switch (c) {
                case charCode('%'):
                    n = 0;
                    m = 0;
                    state = 'HEX0';
                    break;
                case charCode('+'):
                    if(decodeSpaces) c = charCode(' ');
                    // pass thru 没有break注意！！！
                default:
                    out[outIndex++] = c;
                    break;
                }
            break;
        case 'HEX0':
            state = 'HEX1';
            hexchar = c;
            if(charCode('0') <= c && charCode('9')>=c) {
                n = c - charCode('0');
            } else if(charCode('a') <= c && charCode('f')>=c) {
                n = c - charCode('a') + 10;
            } else if(charCode('A') <= c && charCode('F')>=c) {
                n = c - charCode('A') + 10;
            } else  {
                out[outIndex++] = charCode('%');
                out[outIndex++] = c;
                state = 'CHAR';
                break;
            }
            break;

        case 'HEX1' :
            state = 'CHAR';
            if(charCode('0') <= c && charCode('9')>=c) {
                m = c - charCode('0');
            } else if(charCode('a') <= c && charCode('f')>=c) {
                m = c - charCode('a') + 10;
            } else if(charCode('A') <= c && charCode('F')>=c) {
                m = c - charCode('A') + 10;
            } else  {
                out[outIndex++] = charCode('%');
                out[outIndex++] = hexchar;
                out[outIndex++] = c;
                break;
            }
            out[outIndex++] = 16 *n + m;
            break;
        }
    }
    return out.slice(0, outIndex -1);
};

myQueryString.unescape = function (s, decodeSpaces) {
    try {
        return decodeURIComponent(s);
    } catch(e) {
        return myQueryString.unescapeBuffer(s, decodeSpaces).toString();
    }
};

myQueryString.escape = function(str) {
    return encodeURIComponent(str);
};

var stringifyPrimitive = function(v) {
    if(util.isString(v)) {
        return v;
    }
    if(util.isBoolean(v)) {
        return v?'true':'false';
    }
    if(util.isNumber(v)) {
        return isFinite(v) ? v : '';
    }
    return '';
};

myQueryString.stringify = myQueryString.encode = function(obj, sep, eq, options) {
    sep = sep || '&';
    eq = eq || '=';

    var encode = myQueryString.escape;
    if(options && typeof options.encodeURIComponent === 'function') {
        encode = options.encodeURIComponent;
    }
    if(util.isObject(obj)) {
        var keys = Object.keys(obj);
        var fields = [];
        for(var i=0;i<keys.length;i++) {
            var k = key[i];
            var v = obj[k];
            var ks = encode(stringifyPrimitive(k)) + eq;

            if(util.isArray(v)) {
                for(var j=0;j< v.length;j++) {
                    fields.push(ks + encode(stringifyPrimitive(v[j])));
                }
            } else {
                fields.push(ks + encode(stringifyPrimitive(v)));
            }
        }
        return fields.join(sep);
    }
    return '';
};

myQueryString.parse = myQueryString.decode = function(qs, sep, eq, options) {
    sep = sep || '&';
    eq = eq || '=';
    var obj = {};

    if(!util.isString(qs) || qs.length === 0) {
        return obj;
    }

    var regexp = /\+/g;
    qs = qs.split(sep);

    var maxKeys = 1000;
    if(options && util.isNumber(options.maxKeys)) {
        maxKeys = options.maxKeys;
    }
    var len = qs.length;
    // maxKey <= 0 means that we should not limit keys count
    if(maxKeys > 0 && len > maxKeys) {
        len = maxKeys;
    }

    var decode = myQueryString.unescape;
    if(options && typeof options.decodeURIComponent === 'function') {
        decode = options.decodeURIComponent;
    }

    for(var i=0;i<len;++i) {
        var x = qs[i].replace(regexp, '%20'),
            idx = x.indexOf(eq),
            kstr, vstr, k, v;

        if(idx >= 0) {
            kstr = x.substr(0, idx);
            vstr = x.substr(idx+1);
        } else {
            kstr = x;
            vstr = '';
        }
        try {
            k = decode(kstr);
            v = decode(vstr);
        } catch(e) {
            k = myQueryString.unescape(kstr, true);
            v = myQueryString.unescape(vstr, true);
        }

        if(hasOwnProperty(obj, k)) {
            obj[k] = v;
        } else if(util.isArray(obj[k])) {
            obj[k].push(v);
        } else {
            obj[k] = [obj[k], v];
        }
    }
    return obj;

};
