module.exports = {
    config:{},
    data:{
        name:"showIconKey"
    },
    async execute(interaction,componentConfig,callback){

        let path = './images/iconInfographic.png'
        interaction.reply({
            files: [path],
            content:" ",
            ephemeral:true 
        })

        callback({})
    }
}