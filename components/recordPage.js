
const {populateTownVisitControls, populateTownVisitWindow } = require("../sessionTools.js")
module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"recordPage"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        if(session.type == "townVisit"){
            session.session_data.temp = {
                recordPage:interaction.values[0]
            }

            interaction.update({
                content: " ",
                embeds: populateTownVisitWindow(session),
                components: populateTownVisitControls(session)
            })
    
            callback({
                updateSession: session
            })
        }
    }
}