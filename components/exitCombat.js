const { populateTownVisitControls, populateTownVisitWindow }= require("../sessionTools.js");

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
        }
    }
}