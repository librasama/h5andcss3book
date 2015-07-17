$(document).ready(function(){
    $('#saveBtn').on('click', function(){
        var data = {};
        data.id = $('#id').val();
        data.email = $('#email').val();
        data.tel = $('#tel').val();
        data.memo = $('#memo').val();
        $('table:nth-child('+i+')')
        localStorage.setItem(data.id, JSON.stringify(data));
        $('#tips').text('数据已成功保存~~！'+data.id + ": " +localStorage.getItem(data.id));
    });

    $('#findBtn').on('click', function(){
        var findTxt = $('#find').val().trim();
        var data = localStorage.getItem(findTxt);
        if(data) {
            var obj = $.parseJSON(data);
            for(k in obj) {
                $('#'+k).val(obj[k]);
            }
            $('#tips').text('查到记录');
        } else {
            $('#tips').text('查无数据！！');
        }

    });

});