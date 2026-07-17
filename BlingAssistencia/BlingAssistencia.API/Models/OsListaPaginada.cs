namespace MundoSmart.BlingAssistencia.API.Models;

public class OsListaPaginada<T>
{
    public List<T> Itens { get; set; } = [];
    public long Total { get; set; }
    public int Pagina { get; set; }
    public int TamanhoPagina { get; set; }
}
