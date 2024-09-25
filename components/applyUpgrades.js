const { SlashCommandBuilder } = require('@discordjs/builders');
const { populateTownVisitWindow, populateTownVisitControls} = require("../sessionTools.js")
const { clone, calculateAbilityCost } = require("../tools.js")

module.exports = {

	config:{
        getSession:true
    },
    data:{
        name:"applyUpgrades"
    },
	execute(interaction,componentConfig,callback) {
        let session = componentConfig.session
        if(session.type == "townVisit"){
            let temp = session.session_data.temp
            switch(session.session_data.temp.upgradeType){
                case "0":
                    if(temp.upgradeType != undefined && temp.upgradeOption != undefined && temp.abilitySelection != undefined){
                        let upgrade = session.session_data.town.armorylistings.ability[temp.upgradeOption]
                        let ability = session.session_data.player.abilities[temp.abilitySelection]
                        let postAbility = clone(ability)
                        let prevCost = Math.ceil(Math.pow(calculateAbilityCost(ability),2)/450)
                        let valueSets;
                        switch(ability.action_type){
                            case "attack":
                                valueSets = {
                                    "critical":[[0,80,5],"inc"],
                                    "damage_val":[[10,100,5],"inc"],
                                    "numHits":[[1,5,1],"inc"],
                                    "recoil":[[0,100,5],"inc",-1],
                                    "accuracy":[[60,130,10],"inc"],
                                    "speed":[[0,1,2,4],"val"]
                                }
                                break;

                            case "guard":
                                valueSets = {
                                    "guard_val":[[10,200,5],"inc"],
                                    "counter_val":[[0,200,5],"inc"],
                                    "success_level":[[100,200,400],"val"]
                                }
                                break;

                            case "stats":
                                valueSets = {
                                    "speed":[[0,1,2,4],"val"],
                                    "focus":[[60,100,5],"inc"]
                                }
                                break;
                        }
                        let upgradeValues = valueSets[upgrade.stat]
                        switch(upgradeValues[1]){
                            case "inc":
                                if(upgradeValues[2] == -1){
                                    postAbility[upgrade.stat] -= upgradeValues[0][2]
                                } else {
                                    postAbility[upgrade.stat] += upgradeValues[0][2]
                                }
                                break;

                            case "val":
                                let index = upgradeValues[0].indexOf(parseInt(ability[upgrade.stat]))
                                if(upgradeValues[2] == -1){
                                    postAbility[upgrade.stat] = upgradeValues[0][index - 1]
                                } else {
                                    postAbility[upgrade.stat] = upgradeValues[0][index + 1]
                                }
                                break
                        }
                        let postCost = Math.ceil(Math.pow(calculateAbilityCost(postAbility),2)/450)
                        let upgradeCost = (postCost - prevCost) * 1000
                        if(session.session_data.player.gold >= upgradeCost){
                            session.session_data.player.gold -= upgradeCost

                            session.session_data.temp.result = postAbility.name + " has a received an upgrade to its " + upgrade.stat + "!\n(" + ability[upgrade.stat] + " -> " + postAbility[upgrade.stat] + ") - Price: " + upgradeCost + " Gold"
                            
                            session.session_data.player.abilities[temp.abilitySelection] = postAbility
                        
                            interaction.update({
                                content: " ",
                                embeds: populateTownVisitWindow(session),
                                components: populateTownVisitControls(session)
                            })
                
                            callback({
                                updateSession:session
                            })
                        } else {
                            interaction.reply({ content: 'You do not have enough gold to afford this upgrade', ephemeral: true });
                        }
                    } else {
                        interaction.reply({ content: 'An upgrade option and ability option must be selected', ephemeral: true });   
                    }
                    break;

                case "1":
                    if(temp.upgradeType != undefined && temp.upgradeOption != undefined && temp.equipmentSelection != undefined){
                        let upgrade = session.session_data.town.armorylistings.equipment[temp.upgradeOption]
                        let upgradeCost;
                        if(upgrade.pow){
                            upgradeCost = Math.ceil(Math.pow(upgrade.multi,upgrade.roll) * session.session_data.town.level * 1000)
                        } else {
                            upgradeCost = Math.ceil(upgrade.multi * upgrade.roll * session.session_data.town.level * 250)
                        }
                        if(session.session_data.player.gold >= upgradeCost){
                            let equipmentType = ""
                            switch(session.session_data.temp.equipmentSelection){
                                case "0":
                                    equipmentType = "gear"
                                    break;
        
                                case "1":
                                    equipmentType = "weapon"
                                    break;
                            }
        
                            let stat = ""
                            if(upgrade.stat.includes("base")){
                                stat = upgrade.stat + "Boost"
                            } else {
                                stat = upgrade.stat
                            }
                            
                            let targetEquipment = session.session_data.player.inventory[session.session_data.player[equipmentType]]
                            if(!targetEquipment.stats[stat]){
                                targetEquipment.stats[stat] = 0
                            }
        
                            let upgradeValue = Math.ceil(session.session_data.town.level * upgrade.multi) * upgrade.roll
        
                            targetEquipment.stats[stat] += upgradeValue
                            
                            session.session_data.player.gold -= upgradeCost
        
                            let upgradeTypeDict = {
                                "hp":"HP",
                                "atk":"ATK",
                                "def":"DEF",
                                "spatk":"SPATK",
                                "spdef":"SPDEF",
                                "spd":"SPD",
                                "baseAtk":"ATK Ability Base Damage",
                                "baseSpAtk":"SPATK Ability Base Damage",
                                "baseDef":"DEF Ability Guard Value",
                                "baseSpDef":"SPDEF Ability Guard Value",
                            }
        
                            session.session_data.temp.result = targetEquipment.name + " has a received an upgrade!:\n+" + upgradeValue + " " + upgradeTypeDict[upgrade.stat] + " - Price: " + upgradeCost + " Gold"
        
                            interaction.update({
                                content: " ",
                                embeds: populateTownVisitWindow(session),
                                components: populateTownVisitControls(session)
                            })
                
                            callback({
                                updateSession:session
                            })
                        } else {
                            interaction.reply({ content: 'You do not have enough gold for this upgrade', ephemeral: true });
                        }
                    } else {
                        interaction.reply({ content: 'An upgrade option and equipment option must be selected', ephemeral: true });
                    }
                    break;
            }
            
        }
	},
};