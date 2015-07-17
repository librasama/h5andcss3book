function btnDetail_onclick(btn, id) {
    var userType = btn.parentElement.parentElement.children[1].innerHTML;
    if(loadPage(userType, id)) {
        var state = new Object();
        state.userType = userType;
        state.id = id;
        console.log(userType);
        if(userType=='普通用户'){
            history.pushState(state,null, 'edit?id='+id );
        } else {history.pushState(state,null, 'readOnly?id='+id );}
    }
}

function loadPage(userType, id) {
    var url = userType == '普通用户' ?'edit?id='+id :'readOnly?id='+id
    var req = new XMLHttpRequest();
    req.open('GET', url, false);
    req.send(null);
    if(req.status == 200) {
        document.getElementById('sectionDetail').innerHTML = req.responseText;
        return true;
    }
    return false;
}

window.addEventListener('popstate', function(e){
    if(e.state) loadPage(e.state.userType, e.state.id);
});