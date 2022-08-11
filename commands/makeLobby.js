const { SlashCommandBuilder } = require('@discordjs/builders');
const { populateLobbyControls, populateLobbyWindow } = require("../sessionTools.js")
const { clone } = require("../tools.js")


module.exports = {

	data: new SlashCommandBuilder()
		.setName('makelobby')
		.setDescription('Create A Multiplayer Lobby'),
    config:{
        getPlayerData:true
    },
	async execute(interaction,componentConfig,callback) {
        let playerData = componentConfig.playerData
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