const form = document.getElementById("uploadForm");
const status = document.getElementById("status");
const loader = document.getElementById("loader");

const ENDPOINT = "https://workflows.n8nest.cl/webhook/nubox_file_creation";

function validarXLSX(file) {
  return file && file.name.toLowerCase().endsWith(".xlsx");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const clientes = document.getElementById("archivo_clientes").files[0];
  const facturacion = document.getElementById("archivo_facturacion").files[0];

  // Validación XLSX
  if (!validarXLSX(clientes)) {
    status.textContent = "❌ El archivo de clientes debe ser .xlsx";
    return;
  }
  if (!validarXLSX(facturacion)) {
    status.textContent = "❌ El archivo de facturación debe ser .xlsx";
    return;
  }

  status.textContent = "";
  loader.style.display = "block";

  const formData = new FormData();
  formData.append("archivo_clientes", clientes);
  formData.append("archivo_facturacion", facturacion);

  // Logs para depuración: archivos y contenido de FormData
  console.log("Archivos seleccionados:", {
    clientes: clientes ? clientes.name : null,
    facturacion: facturacion ? facturacion.name : null,
  });
  for (const pair of formData.entries()) {
    const value = pair[1];
    console.log("FormData entry:", pair[0], value instanceof File ? value.name : value);
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      body: formData,
    });

    console.log("Fetch completado:", { status: response.status, ok: response.ok, statusText: response.statusText });

    if (!response.ok) {
      const text = await response.text();
      console.error("Error en respuesta del servidor:", { status: response.status, statusText: response.statusText, body: text });
      loader.style.display = "none";
      status.textContent = "⚠️ Error procesando los archivos.";
      return;
    }

    loader.style.display = "none";

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "resultado.csv";
    a.click();

    console.log("Descarga iniciada: resultado.csv");
    status.textContent = "✔ Archivo procesado y descargado.";

  } catch (err) {
    loader.style.display = "none";
    status.textContent = "❌ Error de conexión con el servidor.";
  }
});
