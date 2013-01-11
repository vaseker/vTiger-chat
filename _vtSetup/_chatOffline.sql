CREATE TABLE IF NOT EXISTS `_node_chat_msg` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `chat_from` int(20) NOT NULL DEFAULT '0',
  `chat_to` int(20) NOT NULL DEFAULT '0',
  `date` datetime DEFAULT NULL,
  `msg` text COLLATE utf8_unicode_ci,
  `report` text COLLATE utf8_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `chat_from` (`chat_from`),
  KEY `chat_to` (`chat_to`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci AUTO_INCREMENT=1 ;

CREATE TABLE IF NOT EXISTS `_node_chat_offline` (
`id` INT NOT NULL AUTO_INCREMENT ,
`user` INT NOT NULL ,
`msg` BIGINT NOT NULL ,
PRIMARY KEY (  `id` ) ,
INDEX (  `user` ,  `msg` )
) ENGINE = INNODB;

ALTER TABLE  `_node_chat_offline` ADD FOREIGN KEY (  `msg` ) REFERENCES `_node_chat_msg` (
`id`
) ON DELETE CASCADE ON UPDATE CASCADE ;