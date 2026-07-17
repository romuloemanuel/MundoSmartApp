namespace MundoSmart.BlingAssistencia.API.Models.Bling;

public class BlingListResponse<T>
{
    public List<T>? Data { get; set; }
}

public class BlingItemResponse<T>
{
    public T? Data { get; set; }
}
