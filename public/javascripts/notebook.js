$(document).ready(function(){
    $('#appendBtn').on('click', function(){
        var data = $('#memo').val();
        var time = new Date().getTime();
        localStorage.setItem(time, data);
        alert('数据已经保存');
        loadStorage('#msg');
    });


    function loadStorage(id){
        var result = '<table border="1">';
        for(var i=0;i<localStorage.length;i++) {
            var key = localStorage.key(i);
            var value = localStorage.getItem(key);
            var date = new Date();
            date.setTime(key);
            var datestr = date.toGMTString();
            result += '<tr><td>'+value+'</td><td>'+datestr+'</td></tr>';
        }
        result += '</table>';
        $(id).empty().append($(result));
    }

    $('#initBtn').on('click', function(){
        localStorage.clear();
        alert('全部数据被清除');
        loadStorage('#msg');
    });
});