const { populateTownVisitWindow, populateTownVisitControls} = require("../sessionTools.js")


module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"selectListing"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        session.session_data.temp = {
            selectedItem:parseInt(interaction.values[0])
        }

        interaction.update({
            content: " ",
            embeds: populateTownVisitWindow(session),
            components: populateTownVisitControls(session),
            ephemeral:true
        })

        callback({
            updateSession:session
        })
    }
}