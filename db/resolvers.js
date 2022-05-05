const Usuario = require("../models/Usuario");
const Producto = require("../models/Producto");
const Cliente = require("../models/Cliente");
const Pedido = require("../models/Pedido");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { findById } = require("../models/Usuario");
require("dotenv").config({ path: "variables.env" });

const crearToken = (usuario, secreta, expiresIn) => {
  const { id, email, nombre, apellido } = usuario;
  return jwt.sign({ id, email, nombre, apellido }, secreta, { expiresIn });
};
//Resolver

const resolvers = {
  Query: {
    obtenerUsuario: async (_, {}, ctx) => {
      return ctx.usuario;
    },

    obtenerProductos: async () => {
      try {
        productos = await Producto.find({});
        return productos;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerProducto: async (_, { id }) => {
      //Revisar si el producto existe
      const producto = await Producto.findById(id);
      if (!producto) {
        throw new Error("Producto no encontrado");
      }
      return producto;
    },
    obtenerClientes: async () => {
      try {
        const clientes = await Cliente.find({});
        return clientes;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerClientesVendedor: async (_, {}, ctx) => {
      try {
        const clientes = await Cliente.find({
          vendedor: ctx.usuario.id.toString(),
        });
        return clientes;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerCliente: async (_, { id }, ctx) => {
      //Resvisar si el cliente exite

      const cliente = await Cliente.findById(id);
      //console.log(cliente.vendedor.toString());
      if (!cliente) {
        throw new Error("Cliente no encontrado");
      }

      //Quien lo creó puede verlo
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales para ver este usuario");
      }
      return cliente;
    },
    obtenerPedidos: async () => {
      try {
        const pedidos = await Pedido.find({});
        return pedidos;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerPedidosVendedor: async (_, {}, ctx) => {
      console.log("ctx", ctx);
      try {
        const pedidos = await Pedido.find({
          vendedor: ctx.usuario.id,
        }).populate("cliente");

        console.log("pedidos", pedidos);
        return pedidos;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerPedido: async (_, { id }, ctx) => {
      //Comprobar si el pedido existe o no

      const pedido = await Pedido.findById({ _id: id });
      if (!pedido) {
        throw new Error("Pedido no encontrado");
      }
      //Solo quien lo creo puede verlo
      if (pedido.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes credenciales");
      }
      // Retornar el resultado
      return pedido;
    },
    obtenerPedidosEstado: async (_, { estado }, ctx) => {
      const pedidos = await Pedido.find({ vendedor: ctx.usuario.id, estado });
      return pedidos;
    },
    mejoresClientes: async () => {
      const clientes = await Pedido.aggregate([
        {
          $match: { estado: "COMPLETADO" },
        },
        {
          $group: {
            _id: "$cliente",
            total: { $sum: "$total" },
          },
        },
        {
          $lookup: {
            from: "clientes",
            localField: "_id",
            foreignField: "_id",
            as: "cliente",
          },
        },
        {
          $sort: { total: -1 },
        },
      ]);
      return clientes;
    },
    mejoresVendedores: async () => {
      const vendedores = await Pedido.aggregate([
        {
          $match: { estado: "COMPLETADO" },
        },
        {
          $group: {
            _id: "$vendedor",
            total: { $sum: "$total" },
          },
        },
        {
          $lookup: {
            from: "usuarios",
            localField: "_id",
            foreignField: "_id",
            as: "vendedor",
          },
        },
        {
          $limit: 3,
        },
        {
          $sort: { total: -1 },
        },
      ]);
      return vendedores;
    },
    buscarProducto: async (_, { texto }) => {
      const productos = await Producto.find({
        $text: { $search: texto },
      }).limit(10);
      return productos;
    },
  },
  Mutation: {
    nuevoUsuario: async (_, { input }, ctx) => {
      const { email, password } = input;
      //Revisar si el usuario ya esta registrado
      const existeUsuario = await Usuario.findOne({ email });
      if (existeUsuario) {
        throw new Error("El usuario ya está registrado");
      }
      //Hasshear su usuario
      const salt = await bcryptjs.genSalt(10);
      input.password = await bcryptjs.hash(password, salt);

      //Registar sus datos
      try {
        const usuario = new Usuario(input);

        usuario.save(); //guardarlo en la base de datos

        return usuario;
      } catch (error) {
        console.log(error);
      }
    },

    autenticarUsuario: async (_, { input }) => {
      // Revisar si el usuario existe
      const { email, password } = input;
      const existeUsuario = await Usuario.findOne({ email });
      if (!existeUsuario) {
        throw new Error("El usuario no existe");
      }
      // Resvisar si el passworde es correcto

      const passwordCorrecto = await bcryptjs.compare(
        password,
        existeUsuario.password
      );
      if (!passwordCorrecto) {
        throw new Error("El password es incorrecto");
      }
      //Crear el token
      return { token: crearToken(existeUsuario, process.env.SECRETA, "24h") };
    },

    nuevoProducto: async (_, { input }) => {
      try {
        const producto = new Producto(input);
        //almacenar en la base de dato
        producto.save();
        return producto;
      } catch (error) {
        console.log(error);
      }
    },

    actualizarProducto: async (_, { id, input }) => {
      //Revisar si el producto existe
      let producto = await Producto.findById(id);
      if (!producto) {
        throw new Error("Producto no encontrado");
      }
      producto = await Producto.findOneAndUpdate({ _id: id }, input, {
        new: true,
      });
      return producto;
    },

    eliminarProducto: async (_, { id }) => {
      let producto = await Producto.findById(id);
      if (!producto) {
        throw new Error("Producto no encontrado");
      }

      await Producto.findOneAndDelete({
        _id: id,
      });
      return "Producto eliminado";
    },

    nuevoCliente: async (_, { input }, ctx) => {
      //Verificar si el cliente ya esta registrado
      const { email } = input;

      //console.log(input)
      const cliente = await Cliente.findOne({ email });
      if (cliente) {
        throw new Error("Ese cliente ya esta registrado");
      }
      const nuevoCliente = new Cliente(input);

      //Asiganar el vendedor
      // asignar el vendedor
      nuevoCliente.vendedor = ctx.usuario.id;
      //guardarlo en la base de datos
      try {
        const nuevoClienteGuardado = await nuevoCliente.save();
        return nuevoClienteGuardado;
      } catch (error) {
        console.log(error);
      }
    },

    actualizarCliente: async (_, { id, input }, ctx) => {
      //Verificar si existe cliente
      const cliente = await Cliente.findById(id);
      if (!cliente) {
        throw new Error("cliente no encontrado");
      }
      //Verificar si el vendedor de ese cliente es quien edita
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes credenciales para editar");
      }
      //guardar el cliente
      const clienteActualizado = await Cliente.findOneAndUpdate(
        { _id: id },
        input,
        { new: true }
      );
      clienteActualizado.save();
      return clienteActualizado;
    },

    eliminarCliente: async (_, { id }, ctx) => {
      //Verificar si existe cliente
      const cliente = await Cliente.findById(id);
      if (!cliente) {
        throw new Error("cliente no encontrado");
      }
      //Verificar si el vendedor de ese cliente es quien elimina
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes credenciales para editar");
      }
      await Cliente.findOneAndDelete({ _id: id });

      return "Cliente eliminado";
    },

    nuevoPedido: async (_, { input }, ctx) => {
      const { cliente } = input;
      console.log(cliente);
      //verificar si cliente existe o no
      let clienteEncontrado = await Cliente.findById(cliente);
      if (!clienteEncontrado) {
        throw new Error("Ese cliente no existe");
      }
      //Verificar si el cliente es del vendedor
      if (clienteEncontrado.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }
      //Revisar que el stock esté disponible

      for await (const articulo of input.pedido) {
        const { id } = articulo;
        const producto = await Producto.findById(id);
        console.log(producto);
        if (articulo.cantidad > producto.existencia) {
          throw new Error(
            `El producto ${producto.nombre} excede de la cantidad disponible `
          );
        } else {
          //Restar la cantidad a lo disponible
          producto.existencia = producto.existencia - articulo.cantidad;
          await producto.save();
        }
      }
      // Crear un nuevo pedido
      const nuevoPedido = new Pedido(input);

      //Asignar vendedor al pedido
      nuevoPedido.vendedor = ctx.usuario.id;
      //Guardar en la base de datos
      const nuevoPedidoGuardado = await nuevoPedido.save();
      return nuevoPedidoGuardado;
    },

    actualizarPedido: async (_, { id, input }, ctx) => {
      const { cliente } = input;
      //Verificar si el pedido existe
      const pedido = await Pedido.findById(id);
      if (!pedido) {
        throw new Error("Pedido no encontrado");
      }
      //Verificar cliente
      const clienteEncontrado = await Cliente.findById(cliente);
      if (!clienteEncontrado) {
        throw new Error("Este cliente no existe");
      }

      //Verificar cliente y pedido pertenece al vendedor
      if (clienteEncontrado.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes credenciales");
      }
      //Revisar el Stock
      if (input.pedido) {
        for await (const articulo of input.pedido) {
          const { id } = articulo;
          const producto = await Producto.findById(id);
          if (articulo.cantidad > producto.existencia) {
            throw new Error(
              `El producto ${producto.nombre} excede de la cantidad disponible `
            );
          } else {
            //Restar la cantidad a lo disponible
            producto.existencia = producto.existencia - articulo.cantidad;
            await producto.save();
          }
        }
      }

      //Guardar el pedido
      const pedidoActualizado = await Pedido.findOneAndUpdate(
        { _id: id },
        input,
        { new: true }
      );
      return pedidoActualizado;
    },

    eliminarPedido: async (_, { id }, ctx) => {
      //Verificar que el pedido existe
      const pedido = await Pedido.findById(id);
      if (!pedido) {
        throw new Error("El pedido no existe");
      }
      //Verificar si el vendedor es quien lo borra
      if (pedido.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }
      // Eliminar pedido
      await Pedido.findOneAndDelete({ _id: id });
      return "Pedido eliminado";
    },
  },
};

module.exports = resolvers;
