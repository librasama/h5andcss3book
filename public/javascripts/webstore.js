$(document).ready(function(){
    $('#saveBtn').on('click', function(){
        sessionStorage.setItem('message', $('#input').val());
        $('#input').val('');
    });
    $('#readBtn').on('click', function(){
        var msg = sessionStorage.getItem('message');
        $('#input').val(msg);


    });
});