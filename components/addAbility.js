const { populateCloseInteractionMessage } = require("../sessionTools.js")
const { calculateAbilityCost, populateAbilityCreatorWindow, populateAbilityCreatorButtons } = require("../sessionTools.js")
const { abilityWeights } = require("../data.json")
module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"addAbility"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        if(session.type == "makeAbility"){
            if(session.session_data.temp && session.session_data.temp.confirm){
                let abilityCost = Math.ceil(calculateAbilityCost(
                    session.session_data.ability,
                    abilityWeights.weapon[session.session_data.weapon],
                    abilityWeights.race[session.session_data.race]
                ))
                let cost = Math.ceil(Math.pow(abilityCost,2)/450)
                session.session_data.abilitypoints -= cost
                session.session_data.abilities.push(session.session_data.ability)

                let updates = [
                    {
                        id:session.user_ids[0],
                        path:"abilitypoints",
                        value:session.session_data.abilitypoints
                    },
                    {
                        id:session.user_ids[0],
                        path:"abilities",
                        value:session.session_data.abilities
                    }
                ]

                if(session.session_data.tutorial == 2){
                    updates.push({
                        id:session.user_ids[0],
                        path:"tutorial",
                        value:4
                    })
                }

                if(session.session_data.tutorial == 2){
                    updates.push({
                        id:session.user_ids[0],
                        path:"tutorial",
                        value:5
                    })
                }

                interaction.update(populateCloseInteractionMessage("Ability Added"))
                
                callback({
                    removeSession:session,
                    updatePlayer:updates
                })
            } else {
                if(session.session_data.tutorial == 1){
                    if(session.session_data.tutorialDmgType == session.session_data.ability.damage_type && session.session_data.ability.damage_val == 20 && session.session_data.ability.recoil == 0 && session.session_data.ability.accuracy == 100){
                        session.session_data.temp = {
                            confirm:true
                        }
    
                        interaction.update({
                            content: "Nice job! After we finish making this ability, you'll need to make an ability to defend yourself.\n\nPress the 'Add Ability' button again to add this ability and then do the `/abilities create` command again, entering in a name for a defensive ability this time",
                            components: populateAbilityCreatorButtons(session),
                            embeds: populateAbilityCreatorWindow(session)
                        })
    
                        callback({
                            updateSession:session,
                        })
                    } else {
                        interaction.reply({ content: "You must create an ability with a damage val of 20 and a damage type of " + session.session_data.tutorialDmgType, ephemeral: true }); 
                    }
                } else if(session.session_data.tutorial == 2){
                    if(session.session_data.ability.action_type == "guard" && session.session_data.ability.guard_val == 30 && session.session_data.ability.counter_val == 15 && session.session_data.ability.guard_type == "def"){
                        session.session_data.temp = {
                            confirm:true
                        }
    
                        interaction.update({
                            content: "You're finally ready for your first real battle! Once you've added this ability, use the `/explore` command and select 'Look for an enemy to fight in the wild'",
                            components: populateAbilityCreatorButtons(session),
                            embeds: populateAbilityCreatorWindow(session)
                        })
    
                        callback({
                            updateSession:session,
                        })
                    } else {
                        interaction.reply({ content: "You must create an ability with the following:\n\n**action_type** = **guard**\n**guard_val** = **30**\n**counter_val** = **15**\n\**guard_type** = **def**", ephemeral: true }); 
                    }
                } else {
                    session.session_data.temp = {
                        confirm:true
                    }

                    interaction.update({
                        content: " ",
                        components: populateAbilityCreatorButtons(session),
                        embeds: populateAbilityCreatorWindow(session)
                    })

                    callback({
                        updateSession:session,
                    })
                }
            }
        }
    }
}