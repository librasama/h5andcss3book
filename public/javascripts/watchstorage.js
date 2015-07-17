$(document).ready(function(){
    $('#setBtn').on('click', function () {
        localStorage.test = $('#text1').val();
        //console.log($('#text1').val());
    });

    /**
     * TODO
     * 卧勒个大槽为什么监听不到？？？？
     * 看这个！！！！！
     * http://diveintohtml5.info/storage.html
     *
     */
    window.addEventListener('storage', function (event) {
        if(event.key == 'test') {
            console.log("testddddd");
            var child = '原有值：'+event.oldValue + '<br/>新值：'+event.newValue + '<br/>变动页面地址' + utf8_decode(unescape(event.url));
            $('#output').append(child);
            console.log(event.storageArea);
            console.log(event.storageArea == localStorage);

        }
    }, false);
    function utf8_decode(utftext) {
        var string = "";
        var i = 0;
        var c = c1 = c2 = 0;
        while(i<utftext.length) {
            c = utftext.charCodeAt(i);
            if(c<128) {
                string += String.fromCharCode(c);
            } else if((c<224) && (c>191)) {
                c2 = utftext.charCodeAt(i+1);
                string += String.fromCharCode((c & 31) << 6 | (c2 & 63));//嘛意思？？？
                i+=2;
            } else {
                c2 = utftext.charCodeAt(i+1);
                c3 = utftext.charCodeAt(i+2);
                string += String.fromCharCode((c & 15) << 12 | (c2 & 63) << 6 | (c3 & 63));
                i+=3;
            }
        }
        return string;
    }
});

