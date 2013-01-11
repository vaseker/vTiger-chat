<?php
include_once('vtlib/Vtiger/Module.php');
$moduleInstance = Vtiger_Module::getInstance('Accounts');
$moduleInstance->addLink('DETAILVIEWBASIC','Послать отчет','#" onclick="chatReport();');
?>