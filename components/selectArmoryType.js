const { populateTownVisitWindow, populateTownVisitControls} = require("../sessionTools.js")


module.exports = {

	config:{
        getSession:true
    },
    data:{
        name:"selectArmoryType"
    },
	execute(interaction,componentConfig,callback) {
        let session = componentConfig.session
        if(session.type == "townVisit"){
            if(interaction.values[0] == "0"){
                if(!session.session_data.player.abilities){
                    interaction.reply({ content: "You must create abilities first! Use `/abilities create` and enter in what you would like to name an ability", ephemeral: true });  
                    return;
                }
            }
            session.session_data.temp = {
                upgradeType:interaction.values[0]
            }

            interaction.update({
                content: " ",
                embeds: populateTownVisitWindow(session),
                components: populateTownVisitControls(session)
            })

            callback({
                updateSession:session
            })
        }
	},
};