const fs = require('fs');
const path = require('path');
const opcodes = require('./opcodes.json');

const buffs = {
	power: {skills: [1101,1102,1103,1104,1105,1106,1107,1108,1109,1110,1111,1112,1113,1114,1115,1116,1117,1118,1119,1120,1121,1122,1123,1124,1125,1126,1127,1128,1129,1130,1131,1132,1133,1134,1135,1136,1137,1138], duration: 240000},
	fellowship: {skills: [5010,5011,5012], duration: 600000},
	exp: {skills: [5013,5014,5015], duration: 1800000},
	talent: {skills: [5016,5017,5018], duration: 1800000},
	dual: {skills: [5019,5020,5021], duration: 1800000},
	crafting: {skills: [5022,5023,5024], duration: 300000},
	fish: {skills: [5025,5026,5027], duration: 300000},
	gather: {skills: [5028,5029,5030], duration: 300000}
};

const food = {
	0: {name: 'None', timeout: 0},
	206049: {name: 'Puppy Figurine', timeout: 1200000},
	206050: {name: 'Piglet Figurine', timeout: 5400000}, 
	206051: {name: 'Popori Figurine', timeout: 17400000}
};

const defs = {
	C_START_SERVANT_ACTIVE_SKILL:{data:[['gameId','uint64'],['skill','int32']],version:1},
	C_USE_SERVANT_FEED_ITEM:{data:[['unk1','uint32'],['unk2','uint32'],['id','uint32'],['unk3','uint32']], version:1}
}

module.exports = function Pet(mod) {
	let petId = BigInt(0);
	var timer = null;
	var feedTimer = null;
	let settings = {enabled: false, reuse: false, skill: 'power', power: 40, feed: false, food: 0};
	let toggleFood = false;
	const protocolVersion = mod.dispatch.protocolVersion;

	for(let i in defs) {
		let definition = defs[i].data;
		definition.type = 'root';
		mod.dispatch.addDefinition(i, defs[i].version, definition);
	}

	for(let i in opcodes[protocolVersion]) {
		mod.dispatch.addOpcode(i, opcodes[protocolVersion][i]);
	}

	try {
		settings = JSON.parse(fs.readFileSync(path.join(__dirname, 'settings.json')));
	} catch(ex){}

	function saveSettings() {
		fs.writeFileSync(path.join(__dirname, 'settings.json'), JSON.stringify(settings));
	}

	function feed() {
    	if(petId != BigInt(0) && settings.food != 0 && settings.feed) {
    		if(mod.game.me.status !== 1) {
    			mod.toServer('C_USE_SERVANT_FEED_ITEM', 1, {
					unk1: 1051,
					unk2: 0,
					id: settings.food,
					unk3: 0
				});
    		}

    		feedTimer = setTimeout(feed, Math.floor(Math.random() * 600000 + food[settings.food].timeout));
    	}
    }

	function useSkill() {
		if(petId != BigInt(0) && mod.game.me.alive) {
			let skill = buffs[settings.skill];
			mod.toServer('C_START_SERVANT_ACTIVE_SKILL', 1, {
				gameId: petId,
				skill: skill.skills[settings.skill == 'power' ? skill.skills.length - 1 - (40 - settings.power) : skill.skills.length - 1]
			});

			if(settings.reuse)
				timer = setTimeout(useSkill, Math.floor(Math.random() * (skill.duration - 220000) + 200000));
		}
	}

	mod.hook('C_USE_SERVANT_FEED_ITEM', defs['C_USE_SERVANT_FEED_ITEM'].version, (e) => {
		if(toggleFood) {
			toggleFood = false;
			settings.food = e.id;
			mod.command.message('<font color="#2961bc">Food set to: </font>'+food[settings.food].name);
			saveSettings();
			return false;
		}
	});

	mod.hook('C_START_SERVANT_ACTIVE_SKILL', defs['C_START_SERVANT_ACTIVE_SKILL'].version, (e) => {
		if(e.gameId == petId && buffs.power.skills.includes(e.skill) && settings.enabled) {
			clearTimeout(feedTimer);
			clearTimeout(timer);
			feedTimer = null;
			timer = null;
			useSkill();
			if(settings.feed) {
				feedTimer = setTimeout(feed, Math.floor(Math.random() * 600000 + food[settings.food].timeout));
			}
			return false;
		}
	});

	mod.hook('S_REQUEST_SPAWN_SERVANT', 3, (e) => { if(mod.game.me.is(e.ownerId) && e.type == 1) { petId = e.gameId; } });
	mod.hook('S_REQUEST_DESPAWN_SERVANT', 1, (e) => {
		if(petId == e.gameId) {
			petId = BigInt(0);
			clearTimeout(feedTimer);
			clearTimeout(timer);
			feedTimer = null;
			timer = null;
		}
	});

	mod.command.add('pet', (cmd, arg) => {
		switch(cmd) {
			case 'power':
				let pwr = parseInt(arg);
				if(pwr > 2 && pwr < 41) {
					settings.power = pwr;
					mod.command.message('<font color="#2961bc">Power set to: </font>'+arg);
					saveSettings();
				} else {
					mod.command.message('<font color="#d62424">Invalid power value!</font> Valid interval: 3-40:');
				}
			break;

			case 'reuse':
				mod.command.message((settings.reuse = !settings.reuse) ? 'Automatic skill reuse <font color="#00CC00">enabled!</font>' : 'Automatic skill reuse <font color="#d62424">disabled!</font>');
				saveSettings();
			break;

			case 'feed':
				settings.feed = !settings.feed;
				mod.command.message('Auto feed ' + (settings.feed ? '<font color="#00CC00">enabled!</font>' : '<font color="#d62424">disabled!</font>'));
				saveSettings();
				if(settings.feed == false && feedTimer != null) {
					clearTimeout(feedTimer);
					feedTimer = null;
				} else if(settings.feed == true && timer != null) {
					feedTimer = setTimeout(feed, Math.floor(Math.random() * 600000 + food[settings.food].timeout));
				}
			break;

			case 'food':
				mod.command.message('Feed your pet to set the type of food you want to use.');
				toggleFood = true;
			break;

			case 'skill':
				if(arg) {
					if(Object.keys(buffs).includes(arg)) {
						settings.skill = arg;
						mod.command.message('<font color="#2961bc">Use skill set to: </font>'+arg);
						saveSettings();
					} else {
						mod.command.message('<font color="#d62424">Invalid skill!</font> Valid skill names:');
						mod.command.message(Object.keys(buffs).join(', '));
					}
				} else {
					mod.command.message('<font color="#d62424">Specify a skill!</font> Valid skill names:');
					mod.command.message(Object.keys(buffs).join(', '));
				}
			break;

			case 'use':
				if(arg) {
					if(Object.keys(buffs).includes(arg)) {
						if(petId != BigInt(0)) {
							mod.command.message('<font color="#2961bc">Used </font>'+arg);
							mod.toServer('C_START_SERVANT_ACTIVE_SKILL', 1, {
								gameId: petId,
								skill: buffs[arg].skills[buffs[arg].skills.length - 1]
							});
						} else {
							mod.command.message('<font color="#d62424">Please spawn a partner first!</font>');
						}
					} else {
						mod.command.message('<font color="#d62424">Invalid skill!</font> Valid skill names:');
						mod.command.message(Object.keys(buffs).join(', '));
					}
				} else {
					mod.command.message('<font color="#d62424">Specify a skill!</font> Valid skill names:');
					mod.command.message(Object.keys(buffs).join(', '));
				}
			break;

			case 'help':
				mod.command.message('\n<font color="#00CC00">Available commands:</font>\n<font color="#00CC00">pet feed</font> - Toggle auto feed\n<font color="#00CC00">pet food</font> - Set food type for auto feed\n<font color="#00CC00">pet skill [skillname]</font> - Set skill to use on activation\n<font color="#00CC00">pet use [skillname]</font> - Use skill once\n<font color="#00CC00">pet</font> - Toggle script on/off\n<font color="#00CC00">pet power [amount]</font> - Set which power buff to use (3-40)\n<font color="#00CC00">pet reuse</font> - Toggle automatic skill reuse\n<font color="#00CC00">pet settings</font> - Show your current settings');
			break;

			case 'settings':
				mod.command.message('\n<font color="#00CC00">Settings:</font>\n<font color="#00CC00">Enabled: </font>'+(settings.enabled ? '<font color="#00CC00">yes</font>' : '<font color="#d62424">no</font>')+'\n<font color="#00CC00">Automatic skill reuse: </font>'+(settings.reuse ? '<font color="#00CC00">yes</font>' : '<font color="#d62424">no</font>')+'\n<font color="#00CC00">Skill: </font>'+settings.skill+'\n<font color="#00CC00">Power: </font>'+settings.power+'\n<font color="#00CC00">Autofeed enabled: </font>'+(settings.feed ? '<font color="#00CC00">yes</font>' : '<font color="#d62424">no</font>')+'\n<font color="#00CC00">Food: </font>'+food[settings.food].name);
			break;

			default:
				mod.command.message((settings.enabled = !settings.enabled) ? '<font color="#00CC00">Enabled!</font>' : '<font color="#d62424">Disabled!</font>');
				saveSettings();
			break;
		}
	});
}