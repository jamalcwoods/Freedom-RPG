const { SlashCommandBuilder } = require('@discordjs/builders');
const { populateLobbyControls, populateLobbyWindow } = require("../sessionTools.js")
const { clone } = require("../tools.js")


module.exports = {

	data: new SlashCommandBuilder()
		.setName('makelobby')
		.setDescription('Create A Multiplayer Lobby'),
    config:{
        getPlayerData:true,
        getGuildTown:true,
    },
	async execute(interaction,componentConfig,callback) {
        let playerData = componentConfig.playerData
        let townData = componentConfig.townData
        if(playerData.tutorial != "completed"){
            interaction.reply({ content: "You must complete the tutorial before accessing this command. For help seeing what's next to do, perform the `/tutorial` command", ephemeral: true });    
            callback({})
            return;
        }

        let newSession = {
            type:"lobby",
            session_id: Math.floor(Math.random() * 100000),
            user_ids:[playerData.id],
            session_data:{
                owner:playerData.id,
                lobbyType:"FFA",
                players:[
                    {
                        id:playerData.id,
                        name:playerData.name
                    }
                ],
                townData:townData,
                bans:[]
            }
        }
        
        interaction.reply({
                content: populateLobbyWindow(newSession),
                components: populateLobbyControls(newSession),
                fetchReply:true
        }).then((message) =>{
            newSession.session_data.m_id = message.id
            newSession.session_data.c_id = message.channelId
            callback({
                addSession:newSession
            })
        })
	},
};