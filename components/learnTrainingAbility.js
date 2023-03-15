
const { populateTownVisitWindow, populateTownVisitControls} = require("../sessionTools.js")
const { parseReward } = require("../tools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"learnTrainingAbility"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        
        if(interaction.values[0] == "practiceLessons"){
            delete session.session_data.temp 

            interaction.update({
                content: " ",
                embeds: populateTownVisitWindow(session),
                components: populateTownVisitControls(session)
            })
    
            callback({
                updateSession: session
            })
        } else {
            let ability = session.session_data.town.availableAbilities[interaction.values[0]]
            if(session.session_data.player.gold >= ability[1]){

                session.session_data.player.abilities.push(ability[0])
                session.session_data.temp.resultMessage = session.session_data.player.name + " learned " + ability[0].name + " (-" + ability[1] + " Gold)"
                session.session_data.player.gold -= ability[1]

                interaction.update({
                    content: " ",
                    embeds: populateTownVisitWindow(session),
                    components: populateTownVisitControls(session),
                    ephemeral:true
                })

                let updates = []

                updates.push({
                    id:session.session_data.player.id,
                    path:"",
                    value:session.session_data.player
                })

                callback({
                    updatePlayer:updates,
                    updateSession:session
                })
            }
        }
    }

}