var log=true;//отображать лог в консоли или нет
strings={//список паттернов ответов сервера
	'connected':'[sys][time]%time%[/time]:  Вы вошли как [user]%name%[/user].[/sys]',
	'userJoined':'[sys][time]%time%[/time]: Пользователь [user]%name%[/user] вошел в чат.[/sys]',
	'messageSent':'[out][time]%time%[/time]: [user]%name%[/user]: %text%[/out]',
	'messageReceived':'[in][time]%time%[/time]: [user]%name%[/user]: %text%[/in]',
	'userSplit':'[sys][time]%time%[/time]: Пользователь [user]%name%[/user] покинул чат.[/sys]'
};
function Chat(cred){//сам чат
	var connected=false,reconnect=false,rooms={}
	socket=io.connect($node);//создали сокет
	socket.on('connect',function(){//при успешном подключении
	socket.emit('credentials',cred);//авторизуемся
	if(connected){
		reconnect=true;
		for(var r in rooms){
			socket.emit('roomConnect',rooms[r],function(){});//реконнект к открытым комнатам (вкладкам)
		}
	}
	else {
		connected=true;
		if(log)console.log('i am connected');
		var $list=$("#contacts"),
			$_chat=$("#chat"),
			$rooms=$("#rooms");
			initContactList=function(){//обнуление контакт-листа
				if(log)console.log('generating online-list');
				$list.html('<li><strong>Контакты:</strong></li>');
			};
			initContactList();//создаем контакт-лист
			$rooms.click(function(e){//клик в области комнат
				$e=$(e.target);
				if($e.hasClass('room')){//клик по комнате
					if(!$e.hasClass('this')){//если мы еще не в этой комнате
						setRoom($e.attr('id').replace('room_',''));//заходим в нее
					}
				}
				if($e.hasClass('leaveRoom')){//если нажали на "закрыть комнату"
					leaveRoom($e.parents('.room:last').attr('id').replace('room_',''));//покидаем комнату
				}
			});
			setRoom('');//при соединении входим в общую комнату (холл)
			socket.on('reload',function(){//получаем команду перезапуска (@reload)
				var reload=$("#reload");//ищем форму с данными для переотправки
				if(log)console.log('got reload command');
				if(reload.length>0)reload.submit();//если данные есть, то перезагружаем с ними
				else window.location.reload(true);//иначе просто рефреш
			});
			socket.on('message',function(msg){//получаем сообщение от сервера
				if(msg.room===undefined)msg.room='';//если в сообщении не указана комната, то выбираем 0
				var $chat=$("#chat_"+msg.room);//выбираем чат комнаты
				if($chat.length==0){//если чата комнаты нет
					newRoom(msg);//создаем элементы комнаты и чата
					$chat=$("#chat_"+msg.room);//выбираем чат
				}
				$chat.append(//вставка сообщения в чат
				'<div>'+strings[msg.event]//заполняем шаблон сообщения
				.replace('<','&lt;')//энкодим html
				.replace('>','&gt;')
				.replace(/\[([a-z]+)\]/g, '<span class="$1">')//[foo] -> <span class="foo">
				.replace(/\[\/[a-z]+\]/g, '</span>')
				.replace(/\%time\%/, msg.time)//время
				.replace(/\%name\%/, msg.name)//никней отправителя
				.replace(/\%text\%/, unescape(msg.text))//эскейп текста
				+'</div>');//перенос строки
				if(msg.report!=undefined&&msg.report!=null){
					reportFormPack('received_'+msg.room,msg.report,{'source':false,'show':false,'editable':false});
				}
				$chat.scrollTop($chat.height());//скроллим чат вниз (чтобы сообщения не появлялись в невидимой зоне)
				
				switch(msg.event){//смотрим событие
					case 'userJoined'://если кто-то вошел
						$("#c"+msg.id).addClass('online').attr({'data-cid':msg.cid});
						break;
					case 'connected'://если мы присоединились
						if(reconnect)initContactList();//если это переподключение, то очищаем контакт-лист
						var cls=$.parseJSON(msg.contacts);//парсим полученный список контактов онлайн
						var CL=$.parseJSON(msg.contactList);//парсим ВЕСЬ список контактов

						$.each(CL,function(i,v){
							if(v.id!=cred.id){
								var online=cls[v.id],_cid='',_o='';
								if(online!=undefined){
									_cid=online[0];
									_o='online';
								}
								$list.append('<li class="cl '+_o+'" id="c'+v.id+'" data-id="'+v.id+'" data-cid="'+_cid+'">'+v['last_name']+' '+v['first_name']+'</li>');
							}
						});
						break;
					case 'userSplit'://кто-то вышел
						$("#c"+msg.id).removeClass('online').attr({'data-cid':''});//удаляем его из контакт-листа
						if(msg.id==cred.id)socket.disconnect();//если вышел я, то отключаемся (??)
						break;
				};
			});
			mSend=function(){//посылаем сообщение
				if(reports[0]!=null){//0-это генерируемый, временный отчет
					var $report=reports[0].data();
					reports[0].remove();//дестрой объекта, событий
					reports[0]=null;//зануляем
				}
				else var $report=null;
				socket.emit(//отправка на сервер
					'message',{
						'msg':escape(document.getElementById('input').value),
						'room':$roomChat,
						'report':$report
				});//сообщение и комната
				document.getElementById('input').value='';//очистка поля ввода
			};
			document.getElementById('input').onkeypress = function(e) {if (e.which == '13') {mSend();}};//нажате enter на поле ввода отправляет сообщение
			document.getElementById('send').onclick = function() {mSend();}//клик по "отправить" -  отправляет
			
			$list.bind('dblclick',function(e){//двойной клик на контакте
				var $e=$(e.target);//источник клика
				if($e.hasClass('cl')){//если ткули в контакт
					var rel=parseInt($e.attr('data-id'));//парсим ID контакта
					var cid=$e.attr('data-cid');//парсим ID сокета
					if(rel>0){//если id верен
						var par={'rel':rel,'cid':cid,'nick':$e.text()};
						socket.emit('roomConnect',par,function(res){//вызываем на сервере событие подлючения к комнате с данными второго контакта, вешаем каллбек
							if(res.connected===true){//если сервер подключил к комнате
								rooms[res.room]=par;//логируем открытые комнаты
								newRoom(res);//создаем элементы вкладки комнаты и окна чата
							}
						});
					}
				}
			});
			function selectRoom(room){//переключаемя в комнату
				$("#room_"+room+", #chat_"+room).addClass('this').siblings().removeClass('this');//эти комнату и чат выбираем, остальные скрываем
				$("#input").focus();//фокусируемся на поле ввода
			};
			function setRoom(room){//устанавливаем указатель на комнату
				$roomChat=room;
				selectRoom(room);//переключаем вкладку
			};
			function newChat(room){//создаем окно чата для комнаты
				var $__chat=$("<div />",{'id':'chat_'+room,'class':'chat'});
				$_chat.append($__chat);
				return $__chat;
			};
			function newRoom(res){//создаем новую комнату
				if($("#room_"+res.room).length==0){//если такой комнаты нет
					$rooms.append('<li id="room_'+res.room+'" class="room">'+res.name+'<span class="leaveRoom">X</span></li>');//добавляем вкладку комнаты
				}
				if($("#chat_"+res.room).length==0){//если чата комнаты нет
					newChat(res.room);//создаем чат
				}
				setRoom(res.room);//переходим в комнату
			};
			function leaveRoom(room){//покидаем комнату
				socket.emit('roomLeave',room,function(res){//сообщаем серверу о действии
					if(res===true){//если на сервере успешно произведен выход
						var $id=$("#room_"+room),//покидаемая комната
							$rid=$id.next();//комната, следующая за покидаемой
						if($rid.length==0)$rid=$id.prev();//если следующей нет, выбираем предыдущую
						if($rid.length==0)$rid=$rooms.find('li:first');//если предыдущей нет, выбираем первую (всегда есть, это общая)
						$rid=$rid.attr('id').replace('room_','');//парсим ид комнаты, в которую перейдем
						$("#room_"+room).remove();//убираем вкладку комнаты
						$("#chat_"+room).remove();//убираем окно чата комнаты
						delete rooms[room];//удаляем комнату из списка открытых комнат
						setRoom($rid);//переходим в ближайшую комнату
					}
				});
			};
			if(window.reportForm){//если есть параметры для генерации отчета
				_reportForm(reportForm);//вызываем создание отчета
			}
		}
	});
};
window.onload = function(){//при загрузке всего-всего
	if(parseInt(cred.id)>0){//если ИД пользователя - число>0
		$('#status').html('Вошел в чат как  '+cred.name).hide();//переключем интерфейс
		$("#chatWindow").show();//показываем интерфейс чата
		_chat=new Chat(cred);//создаем чат
	}
};
function popUp(data){//вплывающие окна
	var popup=$('#opaco');//слой с затемнением
	if(popup.length==0){//если слоя нет
		popup=$("<div />",{//создаем его
			'id':'opaco',
			'html':'<div id="popup">'+data+'</div>'//внутри div для контента
		});
		$(popup).click(function(e){//хандлим клик на полупрозрачном слое
			var e=$(e.target);
			if(e.hasClass('close')||e.attr('id')=='opaco'){//если нажали в "закрыть" или по затемнению
				popup.animate({'opacity':0},200,function(){popup.removeClass('visible').find("#popup").html('');});//скрываем попап
			}
		});
		$('body').append(popup);//добавляем попап
	}else{//если элемент уже есть
		popup.find('#popup').html(data);//то вставляем в него новые данные
	}
	popup.addClass('visible').animate({'opacity':1},300);//плавно высплывает
};
function reportFormSourceClick(e,data){//клик на #source
	e=$(e.target);//источник клика
	if(e.hasClass('source')){//если это элемент .source
		var i=parseInt(e.attr('data-id')),//id элемента-целочисленное
			source=e.attr('data-source');//источник
		if(i>0&&source!=undefined){//если данные есть
			if(data.sources[source]!=undefined){//если данные реальны
				data.sources[source]['selected']=i;//ставим указатель на кликнутый доп.элемент
				reportFormRender(data,{'source':true,'show':true,'editable':true});//перерисовываем форму
			}
		}
	}
}
reports=[null];
function reportFormPack(_event,data,opts){//создание свернутого элемента отчета из набора данных. первый параметр - тип создания, второй-данные
	var event='reportOk',//по умолчанию тип-новый отчет
		room='',//в общий чат
		//opts={'source':false,'show':false,'editable':false};
		_room=_event.match(/^received_([0-9\-]*)$/);//если тип - "получено в комнате XX"
		if(_room!=null){
			if(_room.length==2){//если все правильно
				event='received';//событие становится "получен"
				room=_room[1];//выбираем нужную комнату
			}
		};
	if(event=='reportOk'){//обработка создания отчета из таблицы
		//opts={'source':false,'show':true,'editable':true};
		var f=$("#reportFormData");//выбираем форму
		if(f.length>0){//если форма есть
			for(var n in data.fields){//начинаем обход полей
				var d=data.fields[n];
				switch(d.type){//действие по типу поля
					case 'text':
					case 'textarea':
					case 'money':
						data.fields[n]['text']=$("#i_"+n).val();
					break;
					case 'group':
						for(var _n in data.fields[n]['group']){
							data.fields[n]['group'][_n]['text']=$("#i_"+_n).val();
						}
					break;
				}
			}
		}
	};
	var report=$('<div />',{
		'class':'el reportPacked',
		'html':'Прикреплен отчет<div class="del">x</div>',
		'data':data
	});//создаем jQuery-объект отчета
	report.click(function(e){//аттачим эвент клика
		var $e=$(e.target);//место клика
		if($e.hasClass('del')){//клик на удалении
			var i=reports.indexOf(report);
			delete reports[i];//удаляем из списка отчетов (???)
			report.remove();//удаляем объект отчета
		}
		else {//клик по отчету
			reportFormRender($(this).data(),opts);//рисуем форму
		}
	});
	if(event=='received'){//если отчет получен из чата
		report.html('Прикреплен отчет');//меняем текст кнопки
		reports.push(report);//заталкиваем в массив отчетов
		$('#chat_'+room).append(report);//показываем кнопку отчета в чате
	}else if(event=='reportOk'&&opts.editable==false){//если нажимаем "ок" в ПОЛУЧЕННОМ отчете (нередактируемом)
		$("#opaco").click();//просто закрываем отчет
	}
	else{
		if(reports[0]!=null){
			reports[0].remove();
		}
		reports[0]=report;
		$('#attach').append(report);
		$('#opaco').click();
	}
};
function reportFormRender(data,srcParam){//генерация html кода формы
	var fields='',//поля формы
		_sources=0,//есть источники или нет
		src='',//тело табов-источников
		sourceShow=srcParam.show,
		sourceUse=srcParam.source
		editable=srcParam.editable,
		disabled='';
	if(!editable)disabled=' disabled="disabled" ';
	for(var n in data.fields){//n=текстовый идентификатор поля
		var d=data.fields[n],//d=массив данных поля
			t='';//t=поле
		switch(d.type){//выбираем тип поля
			case 'text':
			case 'money':
			case 'textarea':
				t+='<td class="label">'+d.label+'</td>';
				if(d['data-source']!=undefined){//если у поля указан источник данных, то используем его
					var source=data.sources[d['data-source']];//выбираем массив с доп.данными
					if(source.selected>0){//если доп.данные выбраны
						if(source.items[source.selected][n]!=undefined)
						if(sourceUse)d.text=source.items[source.selected][n];//выводим доп.данные
						_sources++;
					}
				}
				if(d.type=='textarea'){
					t+='<td class="value"><textarea '+disabled+' id="i_'+n+'">'+d.text+'</textarea></td>';
				}else{
					t+='<td class="value"><input id="i_'+n+'" '+disabled+' type="text" value="'+d.text+'" /></td>';
				}
			break;
			case 'group':
				var _t='<td class="label" rowspan="%d">'+d.label+'</td>',
					k=0;
				for(var _n in d.group){
					var _d=d.group[_n];
					if(_d['data-source']!=undefined){//если у поля указан источник данных, то используем его
						var source=data.sources[_d['data-source']];//выбираем массив с доп.данными
						if(source.selected>0){//если доп.данные выбраны
							if(source.items[source.selected][_n]!=undefined)
							if(sourceUse)_d.text=source.items[source.selected][_n];//выводим доп.данные
							_sources++;
						}
					}
					if(k!=0){
						_t+='</tr><tr>';
					}
					_t+='<td class="value">'+_d.label+': <input id="i_'+_n+'" '+disabled+' type="text" value="'+_d.text+'" /></td>';
					k++;
				}
				t+=_t.replace('%d',k);

			break;
		}
		fields+='<tr id="tr_'+n+'">'+t+'</tr>';
	}
	if(_sources>0&&sourceShow){//составляем тело табов-источников
		var st='';//источник может быть любым
		if(data.type=='Accounts'){
			st='lots';
			var source=data.sources[st],//доп.таблица
				j=source.selected,//ид выбранного доп.элемента
				source=source.items;//доп.элементы
			for(var i in source){
				var o=source[i];//доп.элемент
				src+='<div class="source '+(i==j?'selected':'')+'" data-id="'+i+'" data-source="'+st+'">'+o['name']+'</div>';
			}
			src='<div id="sources"><h2>Лоты</h2>'
				+src
			+'</div>';
		}
	}
	var form='<div id="reportForm">'
				+'<div class="close">x</div>'
				+src
				+'<h2>'+data.title+'</h2>'
				+'<form id="reportFormData">'
				+'<table>'+fields+'</table>'
				+'<div class="center"><div id="reportSend">Готово</div></div>'
				+'</form>'
			+'</div>';
	popUp(form);//показываем форму
	$('#sources').bind('click',function(e){reportFormSourceClick(e,data);});//лайв потому, что #sources еще нет в DOM
	$("#reportSend").bind('click',function(e){reportFormPack('reportOk',data,srcParam)});//клик на "отправить"
};
function _reportForm(rf){//создаем форму для заполнения отчета
	if(rf.type=='Accounts'){
		popUp('<div id="loading">Загружаю форму отчета...</div>');
		$.ajax({//запрос к странице, с которой пришли
			'url':rf.src,
			'dataType':'html',
			'success':function(data){//получили целую страницу (документ)
				if(log)console.log('generating report form');
				var $data=$(data),
				exp=/\n|\r|\t|\s{2,}|^\s*|\s*$/g,//табы, переносы строк, кучи пробелов
				etext=/<[^>]*>/ig,//выпиливание тегов
				lots={//массив доп.данных
					'selected':0,//указатель на 0 элемент
					'items':{}//список элементов
				},
				_lots=$data.find("#tbl_Accounts_Prizes");//ищем таблицу с инфой о доп.данных(лотах)
				if(_lots.length>0){//если нашли
					function lotsFill(data){//заполняем массив с доп.данными
						if(data!=''&&data!=undefined){//если есть входные данные
							data=$('<div>'+data+'</div>');//генерим DOM для данных
							data=$(data.find('table')[1]).find('tr');//ищем строки второй таблицы
							if(data.length>0){//если строки нашлись
								var c=0;//счетчик считаных строк
								$.each(data,function(i,d){//парсим строки
									if(i>0){//не парсим первую строку (заголовки), отсюда i в массиве доп. данных всегда > 0
										var d=$(d).find('td');//хватаем ячейки
										lots.items[i]={//заплняем элемент доп.данных
												'name':d[0].innerHTML.replace(exp,'').replace(etext,''),
												'sum':d[1].innerHTML.replace(exp,'').replace(etext,''),
												'estimate':d[5].innerHTML.replace(exp,'').replace(etext,''),
												'customer':d[7].innerHTML.replace(exp,'').replace(etext,''),
												'text':d[8].innerHTML.replace(exp,'').replace(etext,'')
											};
											c++;
									}
								});
								if(c>0){
									lots.selected=1;//ставим указатель на первый элемент доп.данных
								}
							}
						}
					};
					if(_lots.html()==''){//если таблица пуста, то она, возможно, не развернута
							var loadButton=$data.find("#show_Accounts_Prizes").parent(),//берем ссылку на получение данных
							prizeHref=loadButton.attr('href').match(/\'([^\']*)\'/ig);//парсим ссылку
							if(prizeHref.length>0){//если парс успешен
								$.ajax({//выполняем загрузку данных
									url:'index.php?'+prizeHref[0].replace("'",''),
									async:false,//зависаем на время получения
									success:function(data){
										lotsFill(data);//заполняем доп.массив полученными данными
									}
								})
							}
					}else{
						lotsFill(_lots.html());//заполняем доп.массив из таблицы
					}
				}
				reportTitle='Отчет по клиенту';//заголовок отчета
				reportFields={//поля отчета
					'manager':{//идентификатор поля
						'label':'Менеджер',//заголовок
						'text':cred.name,//значение
						'type':'text'//тип
					},
					'customer':{
						'label':'Наименование клиента',
						'text':'',
						'type':'textarea',
						'data-source':'lots'//источник данных (доп.источник lots)
					},
					'custAdr':{
						'label':'Заказчик, город',
						'text':$data.find('#dtlview_Ю\\/А\\ Город').text().replace(exp,''),
						'type':'text'
					},
					'name':{
						'label':'Предмет кратко',
						'text':'',
						'type':'textarea',
						'data-source':'lots'
					},
					'sum':{
						'label':'Сумма обеспечения',
						'text':'',
						'type':'money',
						'data-source':'lots'
					},
					'estimate':{
						'label':'Срок действия гарантии или договора поручительства',
						'text':'',
						'type':'text',
						'data-source':'lots'
					},
					'typeBase':{
						'label':'Вид обеспечения',
						'text':'',
						'type':'text'
					},
					'terms':{
						'label':'Требования заказчика\\клиента к гаранту',
						'text':'',
						'type':'textarea'
					},
					'docDeadline':{
						'label':'Срок предоставления документов',
						'text':'',
						'type':'group',
						'group':{
							'scans':{
								'label':'Сканы',
								'text':'',
								'type':'text'
							},
							'originals':{
								'label':'Оригиналы',
								'text':'',
								'type':'text'
							}
						}
					},
					'challenge':{
						'label':'Предложения конкурентов',
						'text':'',
						'type':'textarea'
					},
					'text':{
						'label':'Примечание',
						'text':'',
						'type':'textarea',
						'data-source':'lots'
					},
				};
				if(log)console.log('rendering report form');
				reportFormRender({//формируем html формы отчета
					'fields':reportFields,//поля
					'title':reportTitle,//заголовок
					'type':rf.type,//тип
					'sources':{'lots':lots}//доп.источники
				},
				{
					'source':true,//использовать доп.данные при построении формы
					'show':true,//показывать доп. данные при построении формы
					'editable':true
				}
				);
			}
		});
	}
};