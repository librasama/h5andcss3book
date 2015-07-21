$(document).ready(function(){
    var datatable = $('#datatable');
    var db = openDatabase('Mydata', '', 'My Database', 102400);
    getAllData();
    function addTableRow(row) {
        var rowTr = $('<tr></tr>');
        var nameTd = $('<td id="name">'+row.name+'</td>');
        var memoTd = $('<td>'+row.message+'</td>');
        var timeTd;
        var funcTd;
        var timeInner;
        if(row.title) {
            timeTd =  $('<td>时间</td>');
            funcTd =  $('<td>操作</td>');
        } else {
            timeTd = $('<td>'+new Date(row.time)+'</td>');
            timeInner = $('<input id="time" type="hidden" value="'+row.time+'">');
            funcTd = $('<td><input type="button" class="delbtn">删除</td>');
        }
        rowTr.append(nameTd).append(memoTd).append(timeTd).append(funcTd).append(timeInner);
        datatable.append(rowTr);
    }

    function cleanTable() {
        datatable.empty();
        addTableRow({name:'姓名', message:'留言', title:'true'});
    }

    /**
     * 创建数据库（create if not exists）
     * 查询记录（rs.rows.item）
     */
    function getAllData(){
        db.transaction(function(tx){
            tx.executeSql('create table if not exists MsgData(name TEXT, message TEXT, time INTEGER)', []);
            tx.executeSql('select * from MsgData', [], function (tx, rs) {
                cleanTable();
                console.log("查询到的数据总数:"+rs.rows.length);
                for(var i=0;i<rs.rows.length;i++) {
                    console.log("获取数据："+JSON.stringify(rs.rows.item(i)));
                    addTableRow(rs.rows.item(i));
                }
            });
        });
    }

    /**
     * 插入记录
     * @param name
     * @param memo
     * @param time
     */
    function insertData(name, memo, time) {
        db.transaction(function (tx) {
            tx.executeSql('insert into MsgData values (?, ?, ?)', [name, memo, time], function (tx, rs) {
                alert("成功保存数据！");
                getAllData();
            }, function (tx, error) {
                alert(error.source + "::" + error.message);
            });
        });
    }

    /**
     * 删除记录（用name和time代替主键）
     */
    function deleteDate(name, time) {
        db.transaction(function(tx){
            tx.executeSql('delete from MsgData where name=? and time=? ', [name, time], function(rs, tx) {
                if(rs.length > 1) {
                    alert('OHCH!!删了多余一条！！可能有错误哦！！');
                } else {
                    getAllData();
                }
            });
        });
    }

    $('#saveBtn').on('click', function () {
        var name = $('#name').val();
        var memo = $('#memo').val();
        var time = new Date().getTime();
        insertData(name, memo, time);
    });

    $('#datatable').delegate('.delbtn', 'click', function(){
        var row = $(this).parent().parent();
        var name = row.find('#name').text();
        var time = row.find('#time').val();
        deleteDate(name, time);
    });
});