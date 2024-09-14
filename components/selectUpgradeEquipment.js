const { SlashCommandBuilder } = require('@discordjs/builders');
const { populateTownVisitWindow, populateTownVisitControls} = require("../sessionTools.js")


module.exports = {

	config:{
        getSession:true
    },
    data:{
        name:"selectUpgradeEquipment"
    },
	execute(interaction,componentConfig,callback) {
        let session = componentConfig.session
        if(session.type == "townVisit"){
            
            let hasEquipment = false;
            let equipmentType = ""
            switch(interaction.values[0]){
                case "0":
                    equipmentType = "gear"
                    if(session.session_data.player.gear != null){
                        hasEquipment = true
                    }
                    break;

                case "1":
                    equipmentType = "weapon"
                    if(session.session_data.player.weapon != null){
                        hasEquipment = true
                    }
                    break;
            }

            if(hasEquipment){
                session.session_data.temp.equipmentSelection = interaction.values[0]
            
                interaction.update({
                    content: " ",
                    embeds: populateTownVisitWindow(session),
                    components: populateTownVisitControls(session)
                })
    
                callback({
                    updateSession:session
                })
            } else {
                interaction.reply({ content: 'You do not have any ' + equipmentType + ' currently equipped. You must equip one from your inventory to upgrade it', ephemeral: true });
            }
        }
	},
};