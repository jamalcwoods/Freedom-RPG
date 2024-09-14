const { SlashCommandBuilder } = require('@discordjs/builders');
const { printEquipmentDisplay} = require("../tools.js")


module.exports = {

	config:{
        getSession:true
    },
    data:{
        name:"previewSelectedEquipment"
    },
	execute(interaction,componentConfig,callback) {
        let session = componentConfig.session
        if(session.session_data.temp.equipmentSelection){
            let equipmentType = ""

            switch(session.session_data.temp.equipmentSelection){
                case "0":
                    equipmentType = "gear"
                    break;

                case "1":
                    equipmentType = "weapon"
                    break;
            }
        
            interaction.reply({ content: printEquipmentDisplay( session.session_data.player.inventory[session.session_data.player[equipmentType]]), ephemeral: true });
        } else {
            interaction.reply({ content: "You must select a piece of equipment to upgrade first", ephemeral: true });
        }
	},
};