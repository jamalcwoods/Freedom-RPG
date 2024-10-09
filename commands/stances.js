
const { SlashCommandBuilder } = require('@discordjs/builders');
const { populateStanceManagerControls, populateStanceManagerWindow } = require("../sessionTools.js")
const { clone } = require("../tools.js")
const data = require("../data.json")


module.exports = {

	data: new SlashCommandBuilder()
		.setName('stances')
		.setDescription('View Stance Progression'),
    config:{
        getPlayerData:true
    },
	async execute(interaction,config,callback) {
        let playerData = config.playerData
        if(playerData.tutorial != "completed"){
            interaction.reply({ content: "You must complete the tutorial before accessing this command. For help seeing what's next to do, perform the `/tutorial` command", ephemeral: true });    
            callback({})
            return;
        }

        let newSession = {
            type:"stances",
            session_id: Math.floor(Math.random() * 100000),
            user_ids:[playerData.id],
            session_data:{
                player:playerData
            }
        }
        if(playerData.defaultStance){
            newSession.session_data.viewingStance = playerData.defaultStance 
        } else {
            newSession.session_data.viewingStance = "hp"
        }

        interaction.reply({
            content: " ",
            components: populateStanceManagerControls(newSession),
            embeds: populateStanceManagerWindow(newSession)
        })

        callback({
            addSession:newSession
        })
	},
};