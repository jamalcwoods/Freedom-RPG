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
                    selected:null,
                    sellReward:{
                        gold:0,
                        rep:0
                    }
                }
            }
            
            interaction.reply({
                    content: " ",
                    components: populateInventoryControls(newSession),
                    embeds: populateInventoryWindow(newSession)
            })
            
            callback({
                addSession:newSession
            })
        } else {
            interaction.reply({ content: '```Your inventory is empty\n\nYou can add things to your inventory by using gold to buy weapons or gear from the market.\n\nGold can be earned by using the /explore command and fighting enemies in the wild```', ephemeral: true });
        }
	},
};