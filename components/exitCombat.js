const { populateTownVisitControls, populateTownVisitWindow,populateLobbyControls, populateLobbyWindow }= require("../sessionTools.js");
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

            case "lobby":
                interaction.update({
                    content: populateLobbyWindow(session),
                    components: populateLobbyControls(session),
                    embeds:[]
                })
                break;

        }
    }
}