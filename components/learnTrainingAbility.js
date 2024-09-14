
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

        let ability = session.session_data.town.availableAbilities[session.session_data.temp.selectedItem]
        session.session_data.temp.resultMessage = session.session_data.player.name + " learned " + ability[0].name + " (-" + ability[1] + " Gold)"
        session.session_data.player.gold -= ability[1]
        session.session_data.temp.selectedItem = -1
        session.session_data.player.abilities.push(ability[0])

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