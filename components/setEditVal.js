const { populateStatEditWindow, populateStatEditButtons } = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"setEditVal"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        if(session.type == "stats"){
            session.session_data.editAmount = parseInt(componentConfig.args[0])
            
            interaction.update({
                content: " ",
                components: populateStatEditButtons(session),
                embeds: populateStatEditWindow(session)
            })

            callback({
                updateSession:session
            })
        }
    }
}