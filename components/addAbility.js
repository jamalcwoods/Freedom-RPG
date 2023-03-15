const { populateCloseInteractionMessage } = require("../sessionTools.js")
const { calculateAbilityCost } = require("../sessionTools.js")
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
            let cost = Math.ceil(calculateAbilityCost(
                session.session_data.ability,
                abilityWeights.weapon[session.session_data.weapon],
                abilityWeights.race[session.session_data.race]
            )/3)
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
        }
    }
}