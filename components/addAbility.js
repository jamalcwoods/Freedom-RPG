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

                interaction.update(populateCloseInteractionMessage("Ability Added"))
                
                callback({
                    removeSession:session,
                    updatePlayer:updates
                })
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