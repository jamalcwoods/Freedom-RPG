
const { populateTownVisitWindow, populateTownVisitControls} = require("../sessionTools.js")
const { parseReward } = require("../tools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"marketPurchase"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session

        let item = session.session_data.town.listings[session.session_data.temp.selectedItem]
        reward = parseReward(item[0],session.session_data.player)
        session.session_data.player = reward[0]
        session.session_data.temp.resultMessage = reward[1][0] + " (-" + item[1] + " Gold)"
        session.session_data.player.gold -= item[1]
        session.session_data.temp.selectedItem = -1

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