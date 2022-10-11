const { populateTownVisitControls, populateTownVisitWindow }= require("../sessionTools.js");
const { execute } = require ("./dungeonChoice.js")
module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"exitCombat"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session

        switch(session.type){
            case "townVisit":
                interaction.update({
                    content: " ",
                    embeds: populateTownVisitWindow(session),
                    components: populateTownVisitControls(session),
                    ephemeral:true
                })
                break;

            case "dungeon":
                componentConfig.session.session_data.rankStats.currentLives = parseInt(componentConfig.args[1])
                componentConfig.session.session_data.rankStats.currentHP = parseInt(componentConfig.args[0])
                execute(interaction,componentConfig,callback)
                break;

        }
    }
}