<?php 
	ini_set('display_errors', 0);
	error_reporting(0);
	$node='http://192.168.15.10:8080/';
	$cred=array('id'=>intval($current_user->id),
		'login'=>$current_user->user_name,
		'name'=>$current_user->last_name.($current_user->first_name==''?'':' '.$current_user->first_name)
	);
	$scripts='<script>var $node="'.$node.'";
	var cred='.json_encode($cred).';		
	</script>
	<link href="'.$node.'public/style.css" rel="stylesheet" />
	<script src="'.$node.'socket.io/socket.io.js"></script>
	<script src="'.$node.'public/jquery-1.8.2.min.js"></script>
	<script src="'.$node.'public/client.js"></script>';
	
	if(isset($_REQUEST['report']))
	{
		if(isset($_POST['ref'])) $ref=$_POST['ref'];
		else $ref=@$_SERVER['HTTP_REFERER'];
		if(preg_match("/Accounts/",$ref))
		{
			$iframe='
				<form method="post" style="display:none;" id="reload">
					<input type="hidden" name="ref" value="'.$ref.'" />
				</form>
				<script>var reportForm={\'type\':\'Accounts\',\'src\':\''.$ref.'\'};</script>';
		}
	}
?>
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>Chatter</title>
	<?php echo $scripts;?>
</head>
<body>
<div id="logging">
	<div id="status">Идет вход в систему...</div>
</div>
<div id="chatWindow">
	<div id="chatFrame">
		<ul id="rooms" class="clear">
			<li id="room_" class="room">Общий</li>
		</ul>
		<div id="chat">
			<div id="chat_" class="chat"></div>
		</div>
		<div id="nick"><?php echo $cred['name'].':';?></div>
		<input type="text" id="input" autofocus />
		<div id="attach" class="clear"></div>
		<input type="submit" id="send" value="Отправить" />
	</div>
	<ul id="contacts">
	</ul>
</div>
<?php echo @$iframe; ?>
</body>
</html>