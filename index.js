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
	var notionUrl = '';
	var body = {};
	var extra_headers = [];
	extra_headers['Authorization'] = 'Bearer ' + self.config.apiKey;
	extra_headers['Notion-Version'] = '2022-02-22';
	var rightNow = Date.now();
	var makeRestCall = false;
	
	switch(action.action) {
		case 'start':
			makeRestCall = true;
			notionUrl = 'https://api.notion.com/v1/databases/';
			body = JSON.stringify({
				parent: {
					type:"page_id",
					page_id: self.config.parentPageId,
				},
				title:[{
					type:"text",
					text:{
						content:"TestDB-"+rightNow
					}
				}],
				properties: {
					name: {
						title:{}
					},
					description: {
						rich_text:{}
					},
					companionTime: {
						number:{}
					},
					elapsedTime: {
						number:{}
					},
					createTime: {
						created_time:{}
					}
				}
			});
			break;
		case 'stop':
			self.NOTIONINFO.active = false;
			self.NOTIONINFO.databaseId = '';
			self.NOTIONINFO.startTime = 0;
			break;
		case 'createMarker':
			makeRestCall = true;
			notionUrl = 'https://api.notion.com/v1/pages';
			body = JSON.stringify({
				parent: {
					database_id: self.NOTIONINFO.databaseId
				},
				properties: {
					name: {
						title:[{
							text: {
								content:"This is a name"
							}
						}],
					},
					description: {
						rich_text:[{
							text: {
								content:"This is a description"
							}
						}],
					},
					companionTime: {
						number: rightNow
					},
					elapsedTime: {
						number: rightNow - self.NOTIONINFO.startTime
					}
				}
			});
			break;
		default:
			break;
	};

	console.log(self.NOTIONINFO);

	if(makeRestCall === false) {
		console.log("rest is false");
		return;
	};

	self.system.emit('rest', notionUrl, body, function (err, result) {
		//console.log(result);
		if (err !== null) {
			self.log('error', 'Notion Send Failed (' + result.error.code + ')');
			self.status(self.STATUS_ERROR, result.error.code);
		} else if(result.data.object === 'error') {
			//console.log(result.data.object);
			self.log('error',result.data.code + ' ' + result.data.message)
			self.status(self.STATUS_ERROR, result.data.status);
		} else if(result.data.object === 'database') {
			self.NOTIONINFO.active = true;
			self.NOTIONINFO.databaseId = result.data.id;
			self.NOTIONINFO.startTime = rightNow;
			self.status(self.STATUS_OK);
		} else {
			//console.log(result);
			self.status(self.STATUS_OK);
		}
	},extra_headers);
}

instance_skel.extendedBy(instance);
exports = module.exports = instance;