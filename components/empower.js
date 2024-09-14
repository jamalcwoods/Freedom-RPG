const { populateCombatControls, populateCombatWindow } = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"empower"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session

        for(i in session.session_data.fighters){
            let fighter = session.session_data.fighters[i]
            if(fighter.staticData.id == interaction.user.id){
                if(fighter.empowered){
                    interaction.reply({ content: "Your next ability will no longer be empowered!" , ephemeral: true });
                    fighter.staticData.meterRank = fighter.empowered
                    fighter.empowered = false
                } else {
                    if(fighter.staticData.meterRank > 0){
                        fighter.empowered = fighter.staticData.meterRank
                        fighter.staticData.meterRank = 0
                        interaction.reply({ content: "Your next ability will be empowered!" , ephemeral: true });
                    } else {
                        interaction.reply({ content: "You must fill the combo meter to empower an ability!" , ephemeral: true });
                    }
                }
                break;
            }
        }

        callback({
            updateSession:session
        })
    }
}