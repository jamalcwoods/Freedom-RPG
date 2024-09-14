const { populateManegeAbilityWindow, populateManageAbilityControls } = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"viewAbility"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session

        session.session_data.temp = {
            selected:parseInt(interaction.values[0])
        }
        
        interaction.update({
            content:" ",
            embeds:populateManegeAbilityWindow(session),
            components:populateManageAbilityControls(session),
            ephemeral:true
        })

        callback({
            updateSession:session
        })
    }
}