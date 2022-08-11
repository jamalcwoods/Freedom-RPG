const { populateCombatControls, populateCombatWindow } = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"selectTarget"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session

        for(i in session.session_data.fighters){
            let fighter = session.session_data.fighters[i]
            if(fighter.staticData.id == interaction.user.id){
                if(interaction.user.id == session.session_data.fighters[parseInt(interaction.values[0])].staticData.id){
                    interaction.reply({ content: "You can't target yourself!" , ephemeral: true });
                } else {
                    session.session_data.fighters[i].target = parseInt(interaction.values[0])
                    interaction.deferUpdate()
                }
                break;
            }
        }

        callback({
            updateSession:session
        })
    }
}