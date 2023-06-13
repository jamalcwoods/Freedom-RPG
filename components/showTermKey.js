module.exports = {
    config:{},
    data:{
        name:"showTermKey"
    },
    async execute(interaction,componentConfig,callback){

        let path = './images/termInfographic.png'
        interaction.reply({
            files: [path],
            content:" ",
            ephemeral:true 
        })

        callback({})
    }
}