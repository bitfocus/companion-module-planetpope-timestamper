var instance_skel = require('../../instance_skel');
var debug;
var log;

instance.prototype.NOTIONINFO = {
	active: false,
	databaseId: '',
	startTime:0
}

function instance(system, id, config) {
	var self = this;

	// super-constructor
	instance_skel.apply(this, arguments);

	return self;
}

instance.prototype.updateConfig = function(config) {
	var self = this;

	self.config = config;

	self.actions();
}

instance.prototype.init = function() {
	var self = this;

	self.status(self.STATE_OK);

	debug = self.debug;
	log = self.log;
	
	self.actions(); // export actions
}

// Return config fields for web config
instance.prototype.config_fields = function () {
	var self = this;
	return [
		{
			type: 'text',
			id: 'info',
			width: 12,
			label: 'Information',
			value: 'Use this module to send timestamp information to Notion.'
		},
		{
			type: 'textinput',
			id: 'apiKey',
			label: 'Notion API Key',
			width: 12,
			required: true
		},
		{
			type: 'textinput',
			id: 'parentPageId',
			label: 'Parent Page ID',
			width: 12,
			required: true
		}
	]
}

// When module gets deleted
instance.prototype.destroy = function() {
	var self = this;
	debug("destroy");
}

instance.prototype.actions = function(system) {
	var self = this;

	self.setActions({
		'start': {
			label: 'Start a New Session'
		},
		'createMarker': {
			label: 'Create Marker',
			options: [
				{
					type: 'textinput',
					label: 'Message',
					id: 'message',
					default: ''
				}
			]
		},
		'stop': {
			label: 'Stop a New Session'
		}
	});
}

instance.prototype.action = function(action) {
	var self = this;
	const rightNow = Date.now();
	const isoDate = new Date(rightNow).toISOString();
	
	switch(action.action) {
		case 'start':
			self.startSession(rightNow, isoDate);
			break;
		case 'stop':
			self.stopSession();
			break;
		case 'createMarker':
			self.createMessage(rightNow, isoDate, action.options.message);
			break;
		default:
			break;
	};
}

instance.prototype.createMessage = function(rightNow, isoDate, message) {
	let self = this;

	const elapsedTime = rightNow - self.NOTIONINFO.startTime;
	const totalSeconds = Math.round(elapsedTime / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	let timestampFmt = "";
	if(hours !== 0) {
		timestampFmt = hours.toString().padStart(2,'0')+":"+minutes.toString().padStart(2,'0')+":"+seconds.toString().padStart(2,'0');		
	} else {
		timestampFmt = minutes.toString().padStart(2,'0')+":"+seconds.toString().padStart(2,'0');
	}

	body = JSON.stringify({
		parent: {
			database_id: self.NOTIONINFO.databaseId
		},
		properties: {
			message: {
				title:[{
					text: {
						content:message
					}
				}],
			},
			companionTimeMillis: {
				number: rightNow
			},
			companionTimeDate: {
				rich_text:[{
					text: {
						content: isoDate
					}
				}]
			},
			elapsedTime: {
				number: elapsedTime
			},
			timestampValue: {
				rich_text:[{
					text: {
						content: timestampFmt
					}
				}]
			}
		}
	});
	self.doRestCall('https://api.notion.com/v1/pages',body, rightNow, isoDate);
}

instance.prototype.startSession = function(rightNow, isoDate) {
	let self = this;

	body = JSON.stringify({
		parent: {
			type:"page_id",
			page_id: self.config.parentPageId,
		},
		title:[{
			type:"text",
			text:{
				content:isoDate
			}
		}],
		properties: {
			message: {
				title:{}
			},
			companionTimeMillis: {
				number:{}
			},
			companionTimeDate: {
				rich_text:{}
			},
			elapsedTime: {
				number:{}
			},
			timestampValue: {
				rich_text:{}
			},
			createTime: {
				created_time:{}
			}
		}
	});
	self.doRestCall('https://api.notion.com/v1/databases/', body, rightNow, isoDate);
}

instance.prototype.stopSession = function() {
	let self = this;
	self.NOTIONINFO.active = false;
	self.NOTIONINFO.databaseId = '';
	self.NOTIONINFO.startTime = 0;
}

instance.prototype.doRestCall = function(notionUrl, body, rightNow, isoDate) {
	let self = this;

	var extra_headers = [];
	extra_headers['Authorization'] = 'Bearer ' + self.config.apiKey;
	extra_headers['Notion-Version'] = '2022-02-22';

	self.system.emit('rest', notionUrl, body, function (err, result) {
		if (err !== null) {
			self.log('error', 'Notion Send Failed (' + result.error.code + ')');
			self.status(self.STATUS_ERROR, result.error.code);
		} else if(result.data.object === 'error') {
			self.log('error',result.data.code + ' ' + result.data.message)
			self.status(self.STATUS_ERROR, result.data.status);
		} else if(result.data.object === 'database') {
			self.NOTIONINFO.active = true;
			self.NOTIONINFO.databaseId = result.data.id;
			self.NOTIONINFO.startTime = rightNow;
			self.status(self.STATUS_OK);
			self.createMessage(rightNow, isoDate, 'start');
		} else {
			self.status(self.STATUS_OK);
		}
	},extra_headers);
}

instance_skel.extendedBy(instance);
exports = module.exports = instance;