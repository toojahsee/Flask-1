$(function () {
  let isRequesting = false; // 标记请求状态，防止重复点击

  $('#joinRoomBtn').on('click', function () {
    if (isRequesting) return; // 正在请求中，忽略后续点击

    const roomId = $('#roomIdInput').val().trim();

    if (!roomId) {
      $('#errorMsg').text('请输入房间号').show();
      return;
    }

    $('#errorMsg').hide(); // 隐藏错误提示
    isRequesting = true;
    $('#joinRoomBtn').prop('disabled', true).text('正在加入...');

    // 检查房间是否存在并是否可加入
    $.get('/check_room', { room: roomId })
      .done(function (data) {
        if (data.room && data.player_count < 2) {
          // 房间可加入，跳转页面
          window.location.href = `/room/${encodeURIComponent(roomId)}`;
        } else {
          $('#errorMsg').text('房间已满或无效，请检查房间号或稍后重试。').show();
          isRequesting = false;
          $('#joinRoomBtn').prop('disabled', false).text('加入房间');
        }
      })
      .fail(function () {
        $('#errorMsg').text('服务器请求失败，请检查网络或稍后重试。').show();
        isRequesting = false;
        $('#joinRoomBtn').prop('disabled', false).text('加入房间');
      });
  });
});