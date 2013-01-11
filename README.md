vTiger-chat
===========

Chat on node.js

To install chat run first "npm install" to get required modules then
replace in vTiger modules/Home/vtchat.php

Edit vtchat.php and set proper variable $node, app.js: port, db.host

Then do "node app"


To add message storing feature import to mysql _chatOffline.sql

To add reporting feature for vTiger need to:

1. modify /include/js/general.js:

			//Chat functions
			function chatReport(){//действие при клике на "Отправить отчет"
				return window.open("index.php?module=Home&action=vtchat&report=true","Chat","width=600,height=650,resizable=1,scrollbars=1");
			};
2. copy _vt_add_custom_link.php to vTiger root and run it. this adds report link for the module accounts