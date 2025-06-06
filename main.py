import eventlet
eventlet.monkey_patch()
import os
import glob
from flask import Flask, render_template, send_from_directory, request, redirect, flash, url_for, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO

# 自定义模块
from ai import get_best_move_api
from room import create_room, register_room_routes, get_room_players, rooms, rooms_lock

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# 注册房间相关路由
register_room_routes(app)

# 首页
@app.route('/')
def index():
    return render_template('index.html')

# 静态资源映射（vite 构建产物）
@app.route('/vite/path/<path:filename>')
def vite_static(filename):
    static_dir = os.path.join(app.root_path, 'scr_dist/assets')
    return send_from_directory(static_dir, filename)

# 工具函数：获取 vite 构建的 JS 文件
def get_vite_scripts(prefix: str):
    pattern = os.path.join(app.root_path, f"scr_dist/assets/{prefix}-*.js")
    files = glob.glob(pattern)
    return sorted([os.path.basename(f) for f in files])

# 房间页面（在线对战用）
@app.route('/room')
def room_page():
    room = request.args.get('room')
    color = request.args.get('color')
    mode = request.args.get('mode')

    if mode == 'online' and not room:
        flash("缺少房间号参数")
        return redirect(url_for('room_page'))

    if room:
        create_room(room.upper())

    vite_scripts_js = get_vite_scripts('room')
    common_scripts = get_vite_scripts('game_common')
    return render_template(
        'room.html',
        vite_scripts_js=common_scripts + vite_scripts_js,
        room=room,
        color=color,
        mode=mode
    )

# 游戏主页面（AI 或在线）
@app.route('/game')
def game():
    mode = request.args.get('mode')
    color = request.args.get('color')
    room = request.args.get('room')

    if mode == 'online':
        if not room:
            flash("缺少房间号参数")
            return redirect(url_for('room_page'))

        room = room.upper()
        players = get_room_players(room)

        if players is None:
            flash("无效或不存在的房间号。")
            return redirect(url_for('room_page'))

        if len(players) >= 2:
            flash("房间已满，请选择其他房间。")
            return redirect(url_for('room_page'))

        scripts = get_vite_scripts('game_common') + get_vite_scripts('game')
        return render_template('game_online.html', vite_scripts_js=scripts, color=color, room=room)

    elif mode == 'ai':
        scripts = get_vite_scripts('game_common') + get_vite_scripts('game_ai')
        return render_template('game_ai.html', vite_scripts_js=scripts, color=color, room=room)

    return redirect(url_for('game', mode='ai'))  # 默认重定向到 AI 模式

# 加入房间前检查：是否存在、是否已满
@app.route('/check_room')
def check_room():
    room_id = request.args.get('room', '').upper()

    with rooms_lock:
        room_data = rooms.get(room_id)
        if room_data:
            return jsonify({
                'room': room_id,
                'player_count': len(room_data['players'])
            })
        else:
            return jsonify({
                'room': None,
                'player_count': 0
            })

# AI 模式走子接口
@app.route('/move', methods=['POST'])
def get_best_move():
    return get_best_move_api(request)

# 注册 SocketIO 事件
from game import register_socketio_events
register_socketio_events(socketio, app)

# 启动服务器
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    socketio.run(app, host='0.0.0.0', port=port, debug=True)