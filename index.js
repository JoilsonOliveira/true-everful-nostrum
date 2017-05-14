const HIDE_DURATION = true,
	HIDE_MESSAGE = true

const ITEMS_NOSTRUM = [152898, 184659, 201005], // EU, NA, RU
	BUFF_NOSTRUM_TD = 4030,
	BUFF_NOSTRUM_H = 4031

const sysmsg = require('tera-data-parser').sysmsg

module.exports = function TrueEverfulNostrum(dispatch) {
	let cid = null,
		slot = -1,
		timeout = null,
		cooldown = 0,
		nextUse = 0,
		bgZone = -1,
		alive = false,
		mounted = false,
		inContract = false,
		inBG = false

	dispatch.hook('S_LOGIN', 1, event => {
		({cid} = event)
		nextUse = 0
	})

	dispatch.hook('S_RETURN_TO_LOBBY', 1, event => { nostrum(true) })

	if(HIDE_MESSAGE)
		dispatch.hook('S_SYSTEM_MESSAGE', 1, event => {
			let msg = event.message.split('\x0b'),
				type = msg[0].startsWith('@') ? sysmsg.maps.get(dispatch.base.protocolVersion).code.get(msg[0].slice(1)) : ''

			if(type == 'SMT_ITEM_USED' || type == 'SMT_CANT_USE_ITEM_COOLTIME') {
				let obj = {}

				for(let i = 2; i < msg.length; i += 2) obj[msg[i - 1]] = msg[i]

				for(let item of ITEMS_NOSTRUM)
					if(obj.ItemName == '@item:' + item) return false
			}
		})

	dispatch.hook('S_PCBANGINVENTORY_DATALIST', 1, event => {
		for(let item of event.inventory)
			if(ITEMS_NOSTRUM.includes(item.item)) {
				slot = item.slot

				if(item.cooldown) cooldown = Date.now() + item.cooldown

				item.cooldown = 0 // Cooldowns from this packet don't seem to do anything except freeze your client briefly
				return true
			}
	})

	dispatch.hook('S_ABNORMALITY_BEGIN', 2, abnormality.bind(null, 'S_ABNORMALITY_BEGIN'))
	dispatch.hook('S_ABNORMALITY_REFRESH', 1, abnormality.bind(null, 'S_ABNORMALITY_REFRESH'))
	dispatch.hook('S_ABNORMALITY_END', 1, abnormality.bind(null, 'S_ABNORMALITY_END'))

	dispatch.hook('S_BATTLE_FIELD_ENTRANCE_INFO', 1, event => { bgZone = event.zone })

	dispatch.hook('S_LOAD_TOPO', 1, event => {
		nextUse = 0
		mounted = inContract = false
		inBG = event.zone == bgZone

		nostrum(true)
	})
	dispatch.hook('S_SPAWN_ME', 1, event => { nostrum(!(alive = event.alive)) })
	dispatch.hook('S_CREATURE_LIFE', 1, event => {
		if(event.target.equals(cid) && alive != event.alive) {
			nostrum(!(alive = event.alive))

			if(!alive) {
				nextUse = 0
				mounted = inContract = false
			}
		}
	})

	dispatch.hook('S_MOUNT_VEHICLE', 1, mount.bind(null, true))
	dispatch.hook('S_UNMOUNT_VEHICLE', 1, mount.bind(null, false))

	dispatch.hook('S_REQUEST_CONTRACT', 1, contract.bind(null, true))
	dispatch.hook('S_ACCEPT_CONTRACT', 1, contract.bind(null, false))
	dispatch.hook('S_REJECT_CONTRACT', 1, contract.bind(null, false))
	dispatch.hook('S_CANCEL_CONTRACT', 1, contract.bind(null, false))

	function abnormality(type, event) {
		if(event.target.equals(cid) && (event.id == BUFF_NOSTRUM_TD || event.id == BUFF_NOSTRUM_H)) {
			nextUse = type == 'S_ABNORMALITY_END' ? 0 : Date.now() + Math.floor(event.duration / 2)
			nostrum()

			if(HIDE_DURATION) {
				if(type == 'S_ABNORMALITY_BEGIN') {
					event.duration = 0
					return true
				}
				if(type == 'S_ABNORMALITY_REFRESH') return false
			}
		}
	}

	function mount(enter, event) {
		if(event.target.equals(cid)) nostrum(mounted = enter)
	}

	function contract(enter) {
		nostrum(inContract = enter)
	}

	function nostrum(disable) {
		clearTimeout(timeout)

		if(!disable && alive && !mounted && !inContract && !inBG && slot != -1) timeout = setTimeout(useNostrum, nextUse - Date.now())
	}

	function useNostrum() {
		let time = Date.now()

		if(time >= cooldown) {
			dispatch.toServer('C_PCBANGINVENTORY_USE_SLOT', 1, {slot})
			nextUse = Date.now() + 1000
			nostrum()
		}
		else timeout = setTimeout(useNostrum, cooldown - time)
	}
}