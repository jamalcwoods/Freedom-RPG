const { populateCloseInteractionMessage } = require("../sessionTools.js")
const { calculateAbilityCost } = require("../sessionTools.js")

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
            session.session_data.abilitypoints -= calculateAbilityCost(session)
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