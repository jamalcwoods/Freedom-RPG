const { SlashCommandBuilder } = require('@discordjs/builders');
const { populateInventoryControls, populateInventoryWindow } = require("../sessionTools.js")
const { clone } = require("../tools.js")


module.exports = {

	data: new SlashCommandBuilder()
		.setName('inventory')
		.setDescription('Manage your equipment and gear'),
    config:{
        getPlayerData:true
    },
	async execute(interaction,componentConfig,callback) {
        let playerData = componentConfig.playerData
        if(playerData.inventory){
            let newSession = {
                type:"inventory",
                session_id: Math.floor(Math.random() * 100000),
                user_ids:[playerData.id],
                session_data:{
                    player:playerData,
                    inventory:clone(playerData.inventory),
                    page:1,
                    seleceted:null
                }
            }
            
            interaction.reply({
                    content: " ",
                    components: populateInventoryControls(newSession),
                    embeds: populateInventoryWindow(newSession),
                    ephemeral: true,
            })
            
            callback({
                addSession:newSession
            })
        } else {
            interaction.reply({ content: 'Your inventory is empty', ephemeral: true });
        }
	},
};