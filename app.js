/*
Чат на node.js для vTiger
Возможности: передача сообщений, отображение контакт-листа, передача отчетов, хранение сообщений, передача офлайн-сообщений
author: 		vaseker
release date:	2012.11.27
update date: 	2012.11.27
version: 		0.0.1
version log:
---0.0.1---
initial release: vtiger auth, contact-list, report send, storing, offline layer
*/
var
	express = require('express')
  ,	app = express()
  , http = require('http')
  , server = http.createServer(app)
  , io = require('socket.io').listen(server)
  , mysql = require('mysql')
  , db = mysql.createConnection({
  		host:'127.0.0.1',
		//socketPath:'/var/mysql/mysql.sock',//The path to a unix domain socket to connect to. When used host and port are ignored.
  		user:'root',
  		password:'dba,021.',
  		database:'vtigercrm540201208'
  })
  , port = 8080;
io.set('log level',1);
server.listen(port,function(){console.log('Server started on port '+port);});
app.configure(function(){
	app.use("/public", express.static(__dirname + '/public'));
	app.get('/', function (req, res) {
	  res.sendfile(__dirname + '/index.html');
	});
});
var _contacts={},//онлайн-контакты [0=>SocketID,1=>login,2=>nick]
	contactList={};//список всех контактов
db.connect(function(err){if(err)console.log('db connection: '+err)});//соединение с БД
db.query('select id,user_name,first_name,last_name from vtiger_users order by last_name asc',function(err,data,fields){
	if(err==null)contactList=data;//получаем из БД список ВСЕХ контактов
});
var offline={//класс оффлайн-контактов
		log:false,//логгировать события класса или нет
		users:{},//список офлайн-пользователей
		rooms:{},//список офлайн-комнат
		add:function(id,nick,room,reason){//добавляем офлайн пользователя
				var result=0,//результат добавления - ничего не выполнено (ошибка)
					cid=id;//если уникальный идентификатор пуст, то ид=абсолютному ид
				if(this.users[cid]==undefined){//если пользователя нет в списке офлайн-пользователей
					this.users[cid]={//добавляем его, модель данных для офлайн-пользователя
						id:cid,
						nick:nick,
						rooms:[room]//это массив офлайн-комнат, в которых находится пользователь
					}
					result=1;//создан офлайн-пользователь
				} else {//иначе подлючаем его к комнате
					var r=this.users[cid].rooms,//список комнат пользователя
						f=false;//еще нет в комнате
					for(var i=0;i<r.length;i++){
						if(r[i]==room)f=true;//уже есть в комнате
					}
					if(!f){//если еще не в комнате
						this.users[cid].rooms.push(room);//добавляем ссылку на комнату
						result=2;//не создан, полключен к комнате
					}
					else result=3;//не создан, не подключен
				}
				if(this.rooms.room==undefined){//если офлайн-комнаты еще нет
					this.rooms[room]={};//создаем ее
					this.rooms[room][cid]=cid;//добавляем пользователя
					result=result+' '+1;//комната создана и подключен пользователь
				} else {//ищем пользователя в офлайн-комнате
					var r=this.rooms[room],//список пользователей в комнате
						f=false;//не найден
					for(var i=0;i<r.length;i++){
						if(r[i]==cid)f=true;//найден
					}
					if(!f){//если не найден
						this.rooms[room][cid]=cid;//если пользователя не было, вводим его
						result=result+' '+2;//добавляем в комнату
					}
					else result=result+' '+3;//уже в комнате
				}
				if(this.log){
					console.log(reason?reason:'');
					console.log(this);
					console.log('Adding complete. Result: '+result+';room: '+room);
				}
				return result;
			},
		clients:function(room){
			return this.rooms[room]||{};//вернет список клиентов в офлайн-комнате
		},
		remove:function(id){//удаление офлайн-пользователя
			var c=this.users[id],_n='was not offline',$log='nobody removed';
			if(c!=undefined){//если пользователь в офлайн-листе
				_n=c.nick;//ник пользователя для лога
				var r=c.rooms;//r=список офлайн-комнат
				delete this.users[id];//удаляем офлайн пользователя
				$log='user removed';
				for(var i in r){//i=индекс
					try{
						var _r=r[i],//r=комната
							$r=this.rooms[_r];//список офлайн-пользователей
						for(var j in $r){//j=пользователь
							if(j==id) {
								$log+=(', and user '+j+' ('+_n+') removed from offline-room '+_r);
								delete this.rooms[_r][j];//если этот офлайн-пользователь равен удаляемому, то удаляем
							}
						}
					}catch(e){
							$log=('Error while deleting user '+id+' ('+_n+') from offline-rooms');
					}
				}
			}
			if(this.log){
				console.log('Removing offline user '+id+' ('+_n+') complete. '+$log);
				console.log(this);
			}
		}
};
io.sockets.on('connection',function(socket){//при подключении сокета
	socket.on('credentials',function(req){//при авторизации
		var ID=socket.id
			,$ID=req.id
			,name=req.name
			,login=req.login
			,time = (new Date()).toLocaleTimeString();
		socket.nick=name;
		var $contacts=JSON.stringify(_contacts),
			$cList=JSON.stringify(contactList);
		socket.json.send({'event':'connected','id':$ID,'name':name,'time':time,'contacts':$contacts,'contactList':$cList});//посылаем контакт-лист и онлайн-листы
		_contacts[$ID]=[ID,login,name];
		socket.broadcast.json.send({'event':'userJoined','id':$ID,'cid':ID,'name':name,'time':time});//уведомляем всех о присоединении пользователя
		console.log('Join : '+name);
		offline.remove($ID);
		//получаем офлайн-сообщения
		db.query('SELECT m.chat_from,m.date,m.msg,m.report,CONCAT_WS(" ",u.first_name,u.last_name) name FROM _node_chat_msg as m '
				+',_node_chat_offline as o, vtiger_users as u WHERE o.user=? AND o.msg=m.id AND u.id=m.chat_from '
				+'ORDER BY m.chat_from ASC, m.id ASC',[$ID],function(err,data){
				if(!err){
					var j=0;//счетчик офлайн-сообщений
					for(var i in data){
						var d=data[i],room='';
						roomConnect({cid:'',rel:d['chat_from'],nick:d['name']},function(data){return room=data['room'];});//запихиваем всех в комнаты
						socket.json.send({'event':'messageReceived', 'name':d['name'], 'text':d['msg'],'room':room,'time':d['date'].toLocaleTimeString(),'report':d['report']==''?'':JSON.parse(d['report'])});//отсылаем офлайн-сообщение
						j++;
					}
					if(j>0){//если были получены офлайн сообщения
						db.query("DELETE FROM _node_chat_offline WHERE user=?",[$ID],function(err,data){
							if(!err){
								console.log('Offline messages are deleted by sql '+this.sql);
							}
							else console.log(err);
						});//удаляем офлайн сообщения
					}
				}
		});

		socket.on('message',function(req){//получаем сообщение от клиента
			var time = (new Date()).toLocaleTimeString();
			switch(req.msg){
			case '@reload'://если получена команда перезагрузки клиентов
				io.sockets.emit('reload');//отправляем команду всем подключенным
				break;
			case '@flush':
				db.query('DELETE FROM _node_chat_msg WHERE 1');
				db.query('ALTER TABLE  `_node_chat_msg` AUTO_INCREMENT =1');
				console.log('Chat tables are cleared!');
				break;
			default:
				//console.log('Room is: '+req.room);
				io.sockets.in(req.room).json.send({'event':'messageReceived', 'name':name, 'text':req.msg,'room':req.room,'time':time,'report':req.report});//отсылка всем онлайн-клинтам комнаты
				var chat_to=req.room.replace(new RegExp('^'+$ID+'-|-'+$ID+'$','ig'),''),//ид получателя
					uMsg=0;//ид сообщения в БД
				roomConnect({rel:chat_to,nick:name},function(){});
				db.query('INSERT INTO _node_chat_msg SET ?',{//добавляем сообщение в БД
					chat_from:$ID,
					chat_to:chat_to,
					date:new Date(),
					msg:unescape(req.msg),//анэскейп для того, чтобы сообщения не хранились в utf-8 энкоде
					report:JSON.stringify(req.report)
				},function(err,result){
					if(err){
						console.log(err);
					}
					else {
						uMsg=result.insertId;//ИД вставленного сообщения
						if(req.room!=''){//если сообщение не в общий чат
							var uOffline=offline.clients(req.room);//список офлайн-пользователей в комнате
							var i=0, $sql='INSERT INTO  _node_chat_offline (`id` ,`user` ,`msg`) VALUES ';
							for(var k in uOffline){//собираем инсерт по клиентам
								if(k!=0&&k!=''&&k!=$ID){
									if(i>0)$sql+=', ';
									$sql+='(NULL, \''+k+'\', \''+uMsg+'\')';
									i++;
								}
							}
							if(i>0){//если есть кто-то офлайн
								console.log('Message stored in offline');
								db.query($sql,function(err){if(err){console.log(err);console.log(this.sql)}});//вставляем связь сообщение-офлайн
							}
						}
					}
				});
				break;
			}
			console.log('Message : '+unescape(req.msg));
		});
		socket.on('disconnect',function(){//обработка отсоединения клиента
			console.log('Disconnect : '+name);
			var time = (new Date()).toLocaleTimeString(),
				room = io.sockets.manager.roomClients[ID];//список комнат клиента (можно заменить на введенный позже объект rooms)
			io.sockets.json.send({'event':'userSplit','id':$ID,'name': name, 'time':time});//отсылаем всем сообщение об отключении пользователя

			for(var i in room){//смотрим список подключенных комнат
				var _i=i.replace(/\//ig,''),r='';//в socket.io комнаты имеют названия вида /room, удаляем слэш
				if(_i!=''&&_i!=undefined){//если не общий чат
					offline.add($ID,name,_i,'Socket disconnected -> going to offline');//добавляем пользователя в офлайн
				}
				socket.leave(i);
			}
			delete _contacts[$ID];//удаляем контакт из списка "онлайн"
			delete socket;
			delete io.sockets.sockets[ID];
		});
		
		function roomConnect(req,fn){//подключение  к комнате
			var rel=req.rel,//id собеседника
				room=Math.min($ID,rel)+'-'+Math.max($ID,rel);//название комнаты вида 100-500
			if(_contacts[rel]==undefined){//если собеседник не в онлайне
				offline.add(rel,req.nick,room,'Connecting '+req.nick+' to room:'+room+' (roomConnect)');//создаем его в офлайне
			}else io.sockets.sockets[_contacts[rel][0]].join(room);//иначе присоединяем сокет собеседника к комнате
			socket.join(room);//сами входим в комнату
			fn({'room':room,'name':req.nick,'connected':true});//выполянем калбэк-функцию
		};

		socket.on('roomConnect',function(req,fn){//подключаем клиента к комнате по его просьбе
			roomConnect(req,fn);
		});
		
		socket.on('roomLeave',function(room,fn){//покидаем комнату по просьбе клиента
			/*
			мы не выходим из комнаты, чтобы после закрытия вкладки можно было получать сообщения от собеседника
			*/
			//socket.leave(room);
			fn(true);
		});
		
	});
});