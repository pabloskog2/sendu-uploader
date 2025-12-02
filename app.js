const form = document.getElementById("uploadForm");
const status = document.getElementById("status");
const loader = document.getElementById("loader");

const ENDPOINT = "https://workflows.n8nest.cl:5678/webhook/nubox_file_creation";

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

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      body: formData,
    });

    loader.style.display = "none";

    if (!response.ok) {
      status.textContent = "⚠️ Error procesando los archivos.";
      return;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "resultado.csv";
    a.click();

    status.textContent = "✔ Archivo procesado y descargado.";

  } catch (err) {
    loader.style.display = "none";
    status.textContent = "❌ Error de conexión con el servidor.";
  }
});
